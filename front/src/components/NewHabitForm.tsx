import { Check } from "phosphor-react";
import * as Checkbox from "@radix-ui/react-checkbox";
import { FormEvent, useState } from "react";
import { api } from "../lib/axios";

const avaliableWeekDays = [
    "Domingo",
    "Segunda-feira",
    "Terça-feira",
    "Quarta-feira",
    "Quinta-feira",
    "Sexta-feira",
    "Sábado",
];

export function NewHabitForm() {
    const [title, setTitle] = useState("");
    const [weekDays, setWeekDays] = useState<number[]>([]);

    async function handleSubmit(event: FormEvent) {
        event.preventDefault();

        if (!title || weekDays.length === 0) {
            return;
        }

        await api.post("/habits", {
            title,
            weekDays,
        });

        setTitle("");
        setWeekDays([]);

        alert("Hábito criado com sucesso!");
    }

    function handleToggleWeekDay(weekDay: number) {
        if (weekDays.includes(weekDay)) {
            const weekDaysWithRemovedOne = weekDays.filter(
                (day) => day !== weekDay
            );

            setWeekDays(weekDaysWithRemovedOne);
        } else {
            setWeekDays([...weekDays, weekDay]);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="w-full flex flex-col mt-6">
            <label htmlFor="title" className="font-semibold leading-tight">
                Qual seu comprometimento?
            </label>

            <input
                type="text"
                id="title"
                placeholder="ex.: Estudar, exercícios, etc"
                className="p-4 rounded-lg mt-3 bg-zinc-800 text-white placeholder:text-zinc-400"
                autoFocus
                value={title}
                onChange={(event) => setTitle(event.target.value)}
            />

            <label htmlFor="" className="font-semibold leading-tight mt-4">
                Quais dias da semana?
            </label>

            <div className="flex flex-col gap-2 mt-3">
                {avaliableWeekDays.map((day, i) => {
                    return (
                        <Checkbox.Root
                            key={day}
                            className="flex items-center gap-3 group focus:outline-none"
                            checked={weekDays.includes(i)}
                            onCheckedChange={() => {
                                handleToggleWeekDay(i);
                            }}
                        >
                            <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-zinc-900 border-2 border-zinc-800 transition-all duration-200 ease-[ease] group-data-[state=checked]:bg-green-500 group-data-[state=checked]:border-green-500 group-focus:ring-2 group-focus:ring-violet-600 group-focus:ring-offset-2 group-focus:ring-offset-background">
                                <Checkbox.Indicator>
                                    <Check size={20} className="text-white" />
                                </Checkbox.Indicator>
                            </div>

                            <span className=" text-white leading-tight">
                                {day}
                            </span>
                        </Checkbox.Root>
                    );
                })}
            </div>

            <button
                type="submit"
                className="mt-6 rounded-lg p-4 flex items-center justify-center gap-3 font-semibold bg-green-600 cursor-pointer hover:bg-green-500 transition-colors focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2 focus:ring-offset-zinc-900"
            >
                <Check size={20} weight="bold" /> Criar hábito
            </button>
        </form>
    );
}
