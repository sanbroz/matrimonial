import { markFollowUpDone } from "@/lib/actions/activity";
import { SubmitButton } from "./submit-button";

export function FollowUpDoneButton({ id }: { id: string }) {
  return (
    <form action={markFollowUpDone}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton variant="secondary" pendingText="…">Done</SubmitButton>
    </form>
  );
}
