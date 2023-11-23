interface HabitProps {
    completed: number;
}

export function Habit(props: HabitProps) {
    return (
        <div>
            <p>{props.completed}</p>
        </div>
    );
}
