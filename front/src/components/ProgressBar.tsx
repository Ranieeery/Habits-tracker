import * as Progress from "@radix-ui/react-progress";

interface ProgressBarProps {
    progress: number;
}

export function ProgressBar(props: ProgressBarProps) {
    return (
        <Progress.Root
            className="relative h-3 rounded-xl bg-zinc-700 w-full mt-4"
            style={{
                transform: "translateZ(0)",
            }}
            value={props.progress}
        >
            <Progress.Indicator
                className="h-3 rounded-xl bg-violet-600 w-full"
                style={{ width: `${props.progress}%` }}
            />
        </Progress.Root>
    );
}
