import { Palette } from "lucide-react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useTheme } from "@/hooks/use-theme"
import type { Theme } from "@/providers/theme-provider"

const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: "mount-sinai", label: "Mount Sinai" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
]

export function ThemeSelector() {
  const { theme, setTheme } = useTheme()

  return (
    <Select value={theme} onValueChange={(value) => setTheme(value as Theme)}>
      <SelectTrigger size="sm" className="w-[150px] gap-2">
        <Palette className="h-4 w-4" />
        <SelectValue placeholder="Theme" />
      </SelectTrigger>
      <SelectContent align="end">
        {THEME_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
