import { habitProgressText, habitStepText, habitTarget } from "./habits";
import { Button } from "./ui";

export default function HabitProgress({
  habit,
  value,
  pending,
  onIncrement,
}: {
  habit: any;
  value: number;
  pending: boolean;
  onIncrement: (direction: number) => void;
}) {
  const target = habitTarget(habit);
  return (
    <div className="habit-progress">
      <p className="meta" aria-live="polite">
        {habitProgressText(habit, value)}
      </p>
      <div
        className="progress"
        role="progressbar"
        aria-label={`Progres ${habit.name}`}
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={Math.min(target, value)}
        aria-valuetext={habitProgressText(habit, value)}
      >
        <div
          style={{
            width: `${Math.min(100, (value / target) * 100)}%`,
            background: habit.color || undefined,
          }}
        />
      </div>
      {target > 1 && (
        <div className="row wrap habit-counter">
          <Button
            variant="tonal"
            aria-label={`Kurangi ${habitStepText(habit)} ${habit.name}`}
            disabled={pending || value <= 0}
            onClick={() => onIncrement(-1)}
          >
            −
          </Button>
          <Button
            variant="tonal"
            aria-label={`Tambah ${habitStepText(habit)} ${habit.name}`}
            disabled={pending}
            onClick={() => onIncrement(1)}
          >
            + {habitStepText(habit)}
          </Button>
        </div>
      )}
    </div>
  );
}
