import { useEffect, useState } from "react";
import { generateDates } from "../utils/generate-dates";
import { HabitDay } from "./HabitDay";
import { api } from "../lib/axios";
import dayjs from "dayjs";

const weekDays = ["D", "S", "T", "Q", "Q", "S", "S"];

const summaryDates = generateDates();

const minimumSummaryDatesSize = 18 * 7;
const amountOfDaysToFill = minimumSummaryDatesSize - summaryDates.length;

const firstDayOfTheYear = dayjs().startOf("year").day();

type Summary = {
    id: string;
    date: string;
    amount: number;
    completed: number;
}[];

export function SummaryTable() {
    const [summary, setSummary] = useState<Summary>([]);

    useEffect(() => {
        api.get("summary").then((response) => {
            setSummary(response.data);
        });
    }, []);

    return (
        <div className="w-full flex">
            <div className="grid grid-rows-(--grid-rows) grid-flow-row gap-3">
                {weekDays.map((weekDay, i) => {
                    return (
                        <div
                            key={`${weekDay}-${i}`}
                            className="text-zinc-400 text-xl h-10 w-10 font-bold flex items-center justify-center"
                        >
                            {weekDay}
                        </div>
                    );
                })}
            </div>

            <div className="grid grid-rows-(--grid-rows) grid-flow-col gap-3">
                {firstDayOfTheYear > 0 &&
                    Array.from({ length: firstDayOfTheYear }).map((_, i) => {
                        return generateBlankSummaryDates(i);
                    })}

                {summary.length > 0 &&
                    summaryDates.map((date) => {
                        const dayInSummary = summary.find((day) => {
                            return dayjs(date).isSame(dayjs(day.date), "day");
                        });

                        return (
                            <HabitDay
                                key={date.toString()}
                                date={date}
                                amount={dayInSummary?.amount}
                                defaultCompleted={dayInSummary?.completed}
                            />
                        );
                    })}

                {amountOfDaysToFill > 0 &&
                    Array.from({ length: amountOfDaysToFill }).map((_, i) => {
                        return generateBlankSummaryDates(i);
                    })}
            </div>
        </div>
    );
}

function generateBlankSummaryDates(i: number) {
    return (
        <div
            key={i}
            className="w-10 h-10 bg-zinc-900 border-2 border-zinc-800 rounded-lg opacity-40 cursor-not-allowed"
        />
    );
}
