import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { groupApi } from "../api";
import type { Group, MemoryMode } from "../types";
import { MEMORY_MODES, getTotalStages, normalizeMemoryMode } from "../types";

interface GroupState {
  groups: Group[];
  refreshGroups: () => Promise<void>;
  memoryModeForGroupId: (groupId: number | null) => MemoryMode;
  totalStagesForGroupId: (groupId: number | null) => number;
  memoryModeLabelForGroupId: (groupId: number | null) => string;
  scheduleLabelForGroupId: (groupId: number | null) => string;
}

const GroupContext = createContext<GroupState | undefined>(undefined);

export function GroupProvider({ children }: { children: ReactNode }) {
  const [groups, setGroups] = useState<Group[]>([]);

  const refreshGroups = useCallback(async () => {
    const res = await groupApi.list();
    setGroups(res.data);
  }, []);

  useEffect(() => {
    void refreshGroups();
  }, [refreshGroups]);

  useEffect(() => {
    const handler = () => {
      void refreshGroups();
    };
    window.addEventListener("app-data-changed", handler);
    return () => window.removeEventListener("app-data-changed", handler);
  }, [refreshGroups]);

  const memoryModeForGroupId = (groupId: number | null): MemoryMode => {
    if (groupId == null) return "ebbinghaus";
    const group = groups.find((g) => g.id === groupId);
    return normalizeMemoryMode(group?.memory_mode);
  };

  const totalStagesForGroupId = (groupId: number | null) =>
    getTotalStages(memoryModeForGroupId(groupId));

  const memoryModeLabelForGroupId = (groupId: number | null) => {
    const mode = memoryModeForGroupId(groupId);
    return MEMORY_MODES.find((m) => m.value === mode)?.label ?? "艾宾浩斯 · 间隔复习";
  };

  const scheduleLabelForGroupId = (groupId: number | null) => {
    return memoryModeLabelForGroupId(groupId);
  };

  return (
    <GroupContext.Provider
      value={{
        groups,
        refreshGroups,
        memoryModeForGroupId,
        totalStagesForGroupId,
        memoryModeLabelForGroupId,
        scheduleLabelForGroupId,
      }}
    >
      {children}
    </GroupContext.Provider>
  );
}

export function useGroups() {
  const ctx = useContext(GroupContext);
  if (!ctx) throw new Error("useGroups must be used within GroupProvider");
  return ctx;
}
