import * as Popover from "@radix-ui/react-popover";
import { ProgressBar } from "./ProgressBar";
import clsx from "clsx";
import dayjs from "dayjs";
import { HabitsList } from "./HabitsList";
import { useState } from "react";

interface HabitDayProps {
    date: Date;
    defaultCompleted?: number;
    amount?: number;
}

export function HabitDay({
    defaultCompleted = 0,
    amount = 0,
    date,
}: HabitDayProps) {
    const [completed, setCompleted] = useState(defaultCompleted);

    const completedPercentage =
        amount > 0 ? Math.round((completed / amount) * 100) : 0;

    const dayAndMonth = dayjs(date).format("DD/MM");
    const dayOfWeek = dayjs(date).format("dddd");

    const today = dayjs().startOf("day").toDate();
    const isCurrentDay = dayjs(date).isSame(today);

    function handleCompletedChanged(completed: number) {
        setCompleted(completed);
    }

    return (
        <Popover.Root>
            <Popover.Trigger
                className={clsx(
                    "w-10 h-10 border-2 rounded-lg transition-all duration-200 ease-[ease]",
                    {
                        "bg-zinc-900 border-zinc-800": completedPercentage == 0,
                        "bg-violet-500 border-violet-400":
                            completedPercentage > 0 && completedPercentage < 20,
                        "bg-violet-600 border-violet-500":
                            completedPercentage >= 20 &&
                            completedPercentage < 40,
                        "bg-violet-700 border-violet-600":
                            completedPercentage >= 40 &&
                            completedPercentage < 60,
                        "bg-violet-800 border-violet-700":
                            completedPercentage >= 60 &&
                            completedPercentage < 80,
                        "bg-violet-900 border-violet-800":
                            completedPercentage >= 80,
                        "border-8": isCurrentDay,
                    }
                )}
            />

            <Popover.Portal>
                <Popover.Content className="min-w-[320px] w-full p-6 rounded-2xl bg-zinc-900 flex flex-col">
                    <span className="font-semibold text-zinc-400">
                        {dayOfWeek}
                    </span>
                    <span className="font-extrabold mt-1 leading-tight text-3xl">
                        {dayAndMonth}
                    </span>

                    <ProgressBar progress={completedPercentage} />

                    <HabitsList
                        date={date}
                        onCompletedChange={handleCompletedChanged}
                    />

                    <Popover.Arrow
                        height={8}
                        width={16}
                        className="fill-zinc-900"
                    />
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
}
