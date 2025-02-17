import { Plus, X } from "phosphor-react";

import * as Dialog from "@radix-ui/react-dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";

import logoImage from "../assets/logo.svg";
import { NewHabitForm } from "./NewHabitForm";

export function Header() {
    return (
        <div className="w-full max-w-3xl mx-auto flex items-center justify-between">
            <img src={logoImage} alt="Habit Tracker" />

            <Dialog.Root>
                <Dialog.Trigger
                    type="button"
                    className="border border-violet-500 font-semibold rounded-lg px-6 py-4 flex items-center gap-3 hover:border-violet-300 cursor-pointer transition-colors"
                >
                    <Plus size={20} className="text-violet-500" />
                    Novo hábito
                </Dialog.Trigger>

                <Dialog.Portal>
                    <Dialog.Overlay className="w-screen h-screen bg-black/80 fixed inset-0" />

                    <Dialog.Content className="absolute p-10 bg-zinc-900 rounded-2xl w-full max-w-md top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                        <Dialog.Close className="absolute top-6 right-6 text-zinc-400 cursor-pointer hover:text-zinc-200 ">
                            <X size={24} aria-label="Fechar" />
                        </Dialog.Close>

                        <Dialog.Title className="text-3xl font-extrabold leading-tight">
                            Criar hábito
                        </Dialog.Title>

                        <VisuallyHidden.Root>
                            <Dialog.Description className="text-zinc-400 mt-2">
                                Crie um novo hábito para acompanhar
                            </Dialog.Description>
                        </VisuallyHidden.Root>

                        <NewHabitForm />
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>
        </div>
    );
}
