// The notification job, run by the Cron Trigger every 15 minutes: the morning
// digest (fixed MORNING_DIGEST_TIME) and the daily reminder (reminder_time),
// decided independently by @habits/core. "Now" is the trigger's scheduled
// time, passed in (never read here), and each user's day is computed in their
// own time zone.
import type { CalendarDate } from "@habits/contracts";
import {
	digestMessage,
	isDigestDue,
	isReminderDue,
	overdueRange,
	pendingTodayCount,
	reminderMessage,
	selectDigestContent,
	shouldSendMorningDigest,
	shouldSendReminder,
} from "@habits/core";
import type { AppConfig } from "../config.ts";
import type { Db } from "../db/client.ts";
import {
	createDispatcher,
	FetchBudget,
	fetchCost,
	type PushMessage,
	withinFetchLimit,
} from "../push/dispatch.ts";
import {
	EXPO_RECEIPTS_BATCH,
	getExpoReceipts,
	isDeviceNotRegistered,
} from "../push/expo.ts";
import { errorName, log } from "../lib/log.ts";
import { listLiveCompletions } from "../repos/completions.ts";
import { listHabits } from "../repos/habits.ts";
import { deletePushSubscriptions, listPushTargets } from "../repos/push.ts";
import {
	claimDigestDay,
	claimReminderDay,
	deleteTickets,
	listDueTickets,
	listReminderCandidates,
	type PendingTicket,
} from "../repos/reminders.ts";

/**
 * External fetches per run, under the Free plan's 50 subrequests per
 * invocation (D1 queries have their own limit, also 50 on Free).
 */
export const MAX_FETCHES_PER_RUN = 40;
/** Expo asks to read receipts about 15 minutes after sending. */
export const RECEIPT_DELAY_MS = 15 * 60_000;
/** Expo deletes receipts after 24 hours. */
export const TICKET_MAX_AGE_MS = 24 * 60 * 60_000;
/** A reminder not delivered within 12 hours is useless. */
export const REMINDER_TTL_SECONDS = 12 * 60 * 60;
/** The digest is about today and tomorrow: useless after the afternoon. */
export const DIGEST_TTL_SECONDS = 6 * 60 * 60;

export interface ReminderJobDeps {
	db: Db;
	fetch: typeof fetch;
	now: number;
	config: Pick<AppConfig, "vapid" | "expoAccessToken">;
}

export interface ReminderJobReport {
	receiptsChecked: number;
	devicesRemovedByReceipts: number;
	usersDue: number;
	usersNotified: number;
	usersDeferred: number;
	digests: number;
	reminders: number;
	sent: number;
	failed: number;
	removed: number;
}

export async function runReminderJob(
	deps: ReminderJobDeps
): Promise<ReminderJobReport> {
	const { db, now, config } = deps;
	const budget = new FetchBudget(MAX_FETCHES_PER_RUN);
	const report: ReminderJobReport = {
		receiptsChecked: 0,
		devicesRemovedByReceipts: 0,
		usersDue: 0,
		usersNotified: 0,
		usersDeferred: 0,
		digests: 0,
		reminders: 0,
		sent: 0,
		failed: 0,
		removed: 0,
	};

	await processReceipts(deps, budget, report);

	const send = createDispatcher({
		db,
		fetch: deps.fetch,
		now,
		vapid: config.vapid,
		expoAccessToken: config.expoAccessToken,
	});

	for (const candidate of await listReminderCandidates(db)) {
		const timeZone = candidate.timezone;
		// Time checks first: no query for users with nothing due.
		const digestDue = isDigestDue({
			nowMs: now,
			timeZone,
			enabled: candidate.morning_digest_enabled,
			lastDigestDate: candidate.last_digest_date,
		});
		const reminderDue = isReminderDue({
			nowMs: now,
			timeZone,
			reminderTime: candidate.reminder_time,
			lastReminderDate: candidate.last_reminder_date,
		});
		if (!digestDue.due && !reminderDue.due) continue;
		report.usersDue += 1;
		const today = digestDue.today;

		const targets = withinFetchLimit(
			await listPushTargets(db, candidate.user_id),
			MAX_FETCHES_PER_RUN
		);
		if (targets.length === 0) continue;

		// Decide with the data before claiming: a run with nothing to send leaves
		// the day unclaimed (a single date added later today still gets in).
		// The completions cover the overdue window (2.8.0): same query.
		const range = overdueRange(today);
		const [habits, completions] = await Promise.all([
			listHabits(db, candidate.user_id),
			listLiveCompletions(db, candidate.user_id, range.from, range.to),
		]);
		const outgoing: Outgoing[] = [];
		if (digestDue.due) {
			const content = selectDigestContent(habits, completions, today, {
				timeZone,
			});
			const wanted = shouldSendMorningDigest({
				nowMs: now,
				timeZone,
				enabled: candidate.morning_digest_enabled,
				lastDigestDate: candidate.last_digest_date,
				content,
			});
			if (wanted) {
				outgoing.push({
					claim: claimDigestDay,
					message: {
						kind: "digest",
						...digestMessage(content, candidate.show_titles_in_notifications),
						tag: `digest-${today}`,
						ttl: DIGEST_TTL_SECONDS,
					},
				});
			}
		}
		if (reminderDue.due) {
			// Today's pending habits plus the overdue ones not done yet.
			const pendingCount = pendingTodayCount(habits, completions, today, {
				timeZone,
			});
			const wanted = shouldSendReminder({
				nowMs: now,
				timeZone,
				reminderTime: candidate.reminder_time,
				lastReminderDate: candidate.last_reminder_date,
				pendingCount,
			});
			if (wanted) {
				outgoing.push({
					claim: claimReminderDay,
					message: {
						kind: "reminder",
						...reminderMessage(pendingCount),
						tag: `reminder-${today}`,
						ttl: REMINDER_TTL_SECONDS,
					},
				});
			}
		}

		let notified = false;
		for (const { claim, message } of outgoing) {
			const cost = fetchCost(targets);
			if (!budget.canAfford(cost)) {
				// Not claimed: the next run picks this user up.
				report.usersDeferred += 1;
				break;
			}
			// Claim the day first: a concurrent or repeated run gets false here.
			if (!(await claim(db, candidate.user_id, today, now))) continue;
			budget.spend(cost);
			const result = await send(candidate.user_id, targets, message);
			notified = true;
			if (message.kind === "digest") report.digests += 1;
			else report.reminders += 1;
			report.sent += result.sent;
			report.failed += result.failed;
			report.removed += result.removed;
		}
		if (notified) report.usersNotified += 1;
	}

	return report;
}

interface Outgoing {
	/** Claims the day for this kind (before sending; false: already sent). */
	claim: (
		db: Db,
		userId: string,
		today: CalendarDate,
		now: number
	) => Promise<boolean>;
	message: PushMessage;
}

/**
 * Reads the receipts of Expo tickets sent at least 15 minutes ago: removes
 * devices reported as `DeviceNotRegistered`, forgets the other answered
 * tickets, and drops tickets older than 24 h (Expo no longer has them).
 */
async function processReceipts(
	{ db, fetch: fetcher, now, config }: ReminderJobDeps,
	budget: FetchBudget,
	report: ReminderJobReport
): Promise<void> {
	const tickets = await listDueTickets(
		db,
		now - RECEIPT_DELAY_MS,
		EXPO_RECEIPTS_BATCH
	);
	if (tickets.length === 0 || !budget.canAfford(1)) return;
	budget.spend(1);

	let receipts;
	try {
		receipts = await getExpoReceipts(
			fetcher,
			tickets.map((ticket) => ticket.id),
			config.expoAccessToken
		);
	} catch (error) {
		// Temporary: keep every ticket for the next run.
		log.warn("expo_receipts_failed", { error: errorName(error) });
		return;
	}

	const answered: string[] = [];
	const goneByUser = new Map<string, string[]>();
	for (const ticket of tickets) {
		const receipt = receipts[ticket.id];
		if (!receipt) {
			if (ticket.created_at <= now - TICKET_MAX_AGE_MS)
				answered.push(ticket.id);
			continue;
		}
		report.receiptsChecked += 1;
		answered.push(ticket.id);
		if (isDeviceNotRegistered(receipt)) addGone(goneByUser, ticket);
		else if (receipt.status === "error") {
			log.warn("expo_receipt_error", {
				code: receipt.details?.error ?? null,
			});
		}
	}

	for (const [userId, subscriptionIds] of goneByUser) {
		// Deleting the device also deletes its other tickets (cascade).
		report.devicesRemovedByReceipts += await deletePushSubscriptions(
			db,
			userId,
			subscriptionIds
		);
	}
	await deleteTickets(db, answered);
}

function addGone(map: Map<string, string[]>, ticket: PendingTicket) {
	const ids = map.get(ticket.user_id) ?? [];
	if (!ids.includes(ticket.subscription_id)) ids.push(ticket.subscription_id);
	map.set(ticket.user_id, ids);
}
