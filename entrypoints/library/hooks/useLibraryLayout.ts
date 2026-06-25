import { useCallback, useEffect, useState } from "react";
import {
  getLibraryLayoutPreference,
  setLibraryLayoutPreference,
  type LibraryLayout,
} from "../lib/library-layout-preference";

export function useLibraryLayout() {
  const [layout, setLayoutState] = useState<LibraryLayout>("list");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void getLibraryLayoutPreference().then((value) => {
      setLayoutState(value);
      setReady(true);
    });
  }, []);

  const setLayout = useCallback((next: LibraryLayout) => {
    setLayoutState(next);
    void setLibraryLayoutPreference(next);
  }, []);

  return { layout, setLayout, ready };
}
