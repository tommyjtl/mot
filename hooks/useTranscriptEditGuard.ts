import { useEffect } from "react";
import { useShadowMount } from "../components/overlay/mount-shadow-react";

/** Sync edit-mode flag on shadow host for MAIN-world keyboard guard script. */
export function useTranscriptEditGuard(editMode: boolean): void {
  const { host } = useShadowMount();

  useEffect(() => {
    if (editMode) {
      host.dataset.transcriptEdit = "true";
    } else {
      delete host.dataset.transcriptEdit;
    }
  }, [editMode, host]);
}
