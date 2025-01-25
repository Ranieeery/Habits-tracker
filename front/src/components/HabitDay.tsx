import * as Popover from "@radix-ui/react-popover";

export function HabitDay() {
    return (
        <Popover.Root>
            <Popover.Trigger className="w-10 h-10 bg-zinc-900 border-2 border-zinc-800 rounded-lg" />

            <Popover.Portal>
                <Popover.Content className="min-w-[320px] w-full p-6 rounded-2xl bg-zinc-900 flex flex-col">
                    <span className="font-semibold text-zinc-400">Sábado</span>
                    <span className="font-extrabold mt-1 leading-tight text-3xl">17/01</span>



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
