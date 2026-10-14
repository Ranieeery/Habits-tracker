import type { Habit } from "@habits/contracts";
import { describe, expect, it } from "vitest";
import {
	type DigestContent,
	digestMessage,
	isDigestDue,
	MORNING_DIGEST_TIME,
	selectDigestContent,
	shouldSendMorningDigest,
	type ShouldSendDigestInput,
} from "./digest.ts";
import { NO_RESCHEDULES } from "./reschedule-index.ts";

const SP = "America/Sao_Paulo"; // UTC-3, no DST
const sp = { reschedules: NO_RESCHEDULES, timeZone: SP };
const TODAY = "2026-11-19"; // Thursday

/** An instant given as São Paulo wall-clock time. */
const at = (date: string, time: string) =>
	Date.parse(`${date}T${time}:00-03:00`);

function habit(name: string, overrides: Partial<Habit> = {}): Habit {
	return {
		id: name,
		name,
		schedule: { type: "weekdays", days: [0, 1, 2, 3, 4, 5, 6] },
		start_date: "2026-10-01",
		archived_at: null,
		description: "",
		sort_key: "a0",
		created_at: 1,
		updated_at: 1,
		deleted_at: null,
		...overrides,
	};
}

const consulta = habit("Consulta dermatologista", {
	schedule: { type: "once", date: "2026-11-20" },
	start_date: "2026-11-20",
});
const filtro = habit("Trocar filtro", {
	schedule: { type: "interval", every: 8, anchor_date: "2026-11-19" },
});
const ler = habit("Ler");

describe("selectDigestContent", () => {
	it("highlights today's non-weekday habits and tomorrow's single dates", () => {
		expect(selectDigestContent([ler, filtro, consulta], [], TODAY, sp)).toEqual(
			{
				todayTotal: 2,
				todayPending: 2,
				highlights: ["Trocar filtro"],
				overdue: [],
				tomorrow: ["Consulta dermatologista"],
				dueToday: [],
				dueTomorrow: [],
			}
		);
	});

	it("shows the single date again on its day", () => {
		expect(
			selectDigestContent([ler, consulta], [], "2026-11-20", sp)
		).toMatchObject({
			highlights: ["Consulta dermatologista"],
			overdue: [],
			tomorrow: [],
			dueToday: [],
			dueTomorrow: [],
		});
	});

	it("leaves out completed habits from the highlights", () => {
		const done = [{ habit_id: filtro.id, date: TODAY, deleted_at: null }];
		expect(selectDigestContent([ler, filtro], done, TODAY, sp)).toEqual({
			todayTotal: 2,
			todayPending: 1,
			highlights: [],
			overdue: [],
			tomorrow: [],
			dueToday: [],
			dueTomorrow: [],
		});
	});

	it("is empty when nothing happens today or tomorrow", () => {
		const mondays = habit("Seg", { schedule: { type: "weekdays", days: [1] } });
		expect(selectDigestContent([mondays], [], TODAY, sp)).toEqual({
			todayTotal: 0,
			todayPending: 0,
			highlights: [],
			overdue: [],
			tomorrow: [],
			dueToday: [],
			dueTomorrow: [],
		});
	});
});

const content: DigestContent = {
	todayTotal: 3,
	todayPending: 3,
	highlights: ["Trocar filtro"],
	overdue: [],
	tomorrow: ["Consulta dermatologista"],
	dueToday: [],
	dueTomorrow: [],
};

const base: ShouldSendDigestInput = {
	nowMs: at(TODAY, "09:00"),
	timeZone: SP,
	enabled: true,
	lastDigestDate: "2026-11-18",
	content,
};

describe("shouldSendMorningDigest", () => {
	it("is fixed at 09:00", () => {
		expect(MORNING_DIGEST_TIME).toBe("09:00");
	});

	it("waits for 09:00 and stops after the 3-hour window", () => {
		const send = (time: string) =>
			shouldSendMorningDigest({ ...base, nowMs: at(TODAY, time) });
		expect(send("08:45")).toBe(false);
		expect(send("09:00")).toBe(true);
		expect(send("09:15")).toBe(true);
		expect(send("11:45")).toBe(true);
		expect(send("12:00")).toBe(false);
	});

	it("sends at most once a day", () => {
		expect(shouldSendMorningDigest({ ...base, lastDigestDate: TODAY })).toBe(
			false
		);
	});

	it("can be turned off", () => {
		expect(shouldSendMorningDigest({ ...base, enabled: false })).toBe(false);
	});

	it("needs something pending today or a single date tomorrow", () => {
		const nothing = { ...content, todayPending: 0, tomorrow: [] };
		expect(shouldSendMorningDigest({ ...base, content: nothing })).toBe(false);
		const onlyTomorrow = { ...nothing, tomorrow: ["Consulta"] };
		expect(shouldSendMorningDigest({ ...base, content: onlyTomorrow })).toBe(
			true
		);
	});

	it("uses the user's zone", () => {
		// 09:00 in São Paulo is 21:00 in Tokyo.
		expect(shouldSendMorningDigest({ ...base, timeZone: "Asia/Tokyo" })).toBe(
			false
		);
		expect(
			shouldSendMorningDigest({
				...base,
				timeZone: "Asia/Tokyo",
				nowMs: Date.parse("2026-11-19T09:00:00+09:00"),
			})
		).toBe(true);
	});

	it("starts over the next day", () => {
		expect(
			shouldSendMorningDigest({
				...base,
				lastDigestDate: TODAY,
				nowMs: at("2026-11-20", "09:15"),
			})
		).toBe(true);
	});
});

describe("isDigestDue", () => {
	it("returns the user's today with the decision", () => {
		expect(isDigestDue(base)).toEqual({ due: true, today: TODAY });
	});
});

describe("digestMessage", () => {
	it("names today's highlights, the total and tomorrow", () => {
		expect(digestMessage(content, true)).toEqual({
			title: "Resumo do dia",
			body: "Hoje: Trocar filtro. 3 hábitos hoje. Amanhã: Consulta dermatologista.",
		});
	});

	it("omits empty parts", () => {
		expect(
			digestMessage(
				{
					todayTotal: 1,
					todayPending: 1,
					highlights: [],
					overdue: [],
					tomorrow: [],
					dueToday: [],
					dueTomorrow: [],
				},
				true
			).body
		).toBe("1 hábito hoje.");
		expect(
			digestMessage(
				{
					todayTotal: 0,
					todayPending: 0,
					highlights: [],
					overdue: [],
					tomorrow: ["A", "B"],
					dueToday: [],
					dueTomorrow: [],
				},
				true
			).body
		).toBe("Amanhã: A e B.");
	});

	it("is generic when titles are hidden", () => {
		expect(digestMessage(content, false).body).toBe(
			"Você tem compromissos hoje e amanhã."
		);
		expect(digestMessage({ ...content, tomorrow: [] }, false).body).toBe(
			"Você tem compromissos hoje."
		);
		expect(digestMessage({ ...content, todayPending: 0 }, false).body).toBe(
			"Você tem um compromisso amanhã."
		);
	});

	it("never names habits when titles are hidden", () => {
		const { title, body } = digestMessage(content, false);
		expect(`${title} ${body}`).not.toMatch(/filtro|Consulta/);
	});

	it("fits the payload limit with many long names", () => {
		const long = Array.from(
			{ length: 12 },
			(_, i) => `Hábito ${i} ${"x".repeat(100)}`
		);
		const { body } = digestMessage(
			{
				todayTotal: 20,
				todayPending: 20,
				highlights: long,
				overdue: [],
				tomorrow: long,
				dueToday: [],
				dueTomorrow: [],
			},
			true
		);
		expect(body.length).toBeLessThanOrEqual(240);
		expect(body).toMatch(/mais 11/);
	});
});

describe("overdue habits in the digest (2.8.0)", () => {
	const conta = habit("Pagar condomínio", {
		schedule: { type: "monthly_days", days: [15] },
		start_date: "2026-10-01",
	});

	it("lists the overdue habits not completed yet", () => {
		expect(selectDigestContent([ler, conta], [], TODAY, sp)).toEqual({
			todayTotal: 1,
			todayPending: 1,
			highlights: [],
			overdue: ["Pagar condomínio"],
			tomorrow: [],
			dueToday: [],
			dueTomorrow: [],
		});
		const lateDone = [{ habit_id: conta.id, date: TODAY, deleted_at: null }];
		expect(
			selectDigestContent([ler, conta], lateDone, TODAY, sp)
		).toMatchObject({ todayTotal: 2, todayPending: 1, overdue: [] });
	});

	it("sends for an overdue habit alone", () => {
		const onlyOverdue = {
			todayTotal: 0,
			todayPending: 0,
			highlights: [],
			overdue: ["Pagar condomínio"],
			tomorrow: [],
			dueToday: [],
			dueTomorrow: [],
		};
		expect(shouldSendMorningDigest({ ...base, content: onlyOverdue })).toBe(
			true
		);
	});

	it("counts and names them with titles", () => {
		expect(
			digestMessage({ ...content, overdue: ["Pagar condomínio"] }, true).body
		).toBe(
			"Hoje: Trocar filtro. 3 hábitos hoje. 1 atrasado: Pagar condomínio. Amanhã: Consulta dermatologista."
		);
		expect(
			digestMessage(
				{
					todayTotal: 0,
					todayPending: 0,
					highlights: [],
					overdue: ["A", "B"],
					tomorrow: [],
					dueToday: [],
					dueTomorrow: [],
				},
				true
			).body
		).toBe("2 atrasados: A e B.");
	});

	it("only counts them when titles are hidden", () => {
		expect(
			digestMessage({ ...content, overdue: ["Pagar condomínio"] }, false).body
		).toBe(
			"Você tem compromissos hoje, 1 hábito atrasado e um compromisso amanhã."
		);
		expect(
			digestMessage({ ...content, tomorrow: [], overdue: ["A", "B"] }, false)
				.body
		).toBe("Você tem compromissos hoje e 2 hábitos atrasados.");
		const { title, body } = digestMessage(
			{
				todayTotal: 0,
				todayPending: 0,
				highlights: [],
				overdue: ["Pagar condomínio"],
				tomorrow: [],
				dueToday: [],
				dueTomorrow: [],
			},
			false
		);
		expect(body).toBe("Você tem 1 hábito atrasado.");
		expect(`${title} ${body}`).not.toMatch(/condomínio/);
	});

	it("fits the payload limit with three long lists", () => {
		const long = Array.from(
			{ length: 12 },
			(_, i) => `Hábito ${i} ${"x".repeat(100)}`
		);
		const { body } = digestMessage(
			{
				todayTotal: 20,
				todayPending: 20,
				highlights: long,
				overdue: long,
				tomorrow: long,
				dueToday: [],
				dueTomorrow: [],
			},
			true
		);
		expect(body.length).toBeLessThanOrEqual(240);
		expect(body).toMatch(/12 atrasados: /);
	});
});
