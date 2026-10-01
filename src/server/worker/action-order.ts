import type { ActionType } from "@prisma/client";

const ACTION_PRIORITY: Record<ActionType, number> = {
  AI: 1,
  ADD_LABEL: 2,
  COMMENT: 2,
  SLACK: 3,
};

export function sortActions<
  T extends {
    actionType: ActionType;
    createdAt: Date;
  }
>(actions: T[]) {
  return [...actions].sort((a, b) => {
    const priorityDifference =
      ACTION_PRIORITY[a.actionType] -
      ACTION_PRIORITY[b.actionType];

    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    return (
      a.createdAt.getTime() -
      b.createdAt.getTime()
    );
  });
}
