import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_LIBRARY_SORT,
  LIBRARY_SORT_LABELS,
  type LibrarySortOption,
} from "../lib/sort-entries";

type LibrarySortSelectProps = {
  value: LibrarySortOption;
  onValueChange: (value: LibrarySortOption) => void;
  disabled?: boolean;
};

export function LibrarySortSelect({
  value,
  onValueChange,
  disabled = false,
}: LibrarySortSelectProps) {
  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={(next) => onValueChange(next as LibrarySortOption)}
    >
      <SelectTrigger
        id="library-sort"
        aria-label="Sort saved items"
        className="h-10 w-auto min-w-[9.5rem] shrink-0 px-3"
      >
        <SelectValue placeholder="Sort" />
      </SelectTrigger>
      <SelectContent align="end">
        <SelectGroup>
          <SelectLabel className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
            Date
          </SelectLabel>
          <SelectItem value="date-desc">{LIBRARY_SORT_LABELS["date-desc"]}</SelectItem>
          <SelectItem value="date-asc">{LIBRARY_SORT_LABELS["date-asc"]}</SelectItem>
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
            Contexts
          </SelectLabel>
          <SelectItem value="contexts-desc">
            {LIBRARY_SORT_LABELS["contexts-desc"]}
          </SelectItem>
          <SelectItem value="contexts-asc">
            {LIBRARY_SORT_LABELS["contexts-asc"]}
          </SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

export { DEFAULT_LIBRARY_SORT };
