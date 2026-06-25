import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FEMALE_VOICE_OPTIONS,
  MALE_VOICE_OPTIONS,
  type Voice,
} from "@/utils/supertonic/voices";
import type { Lang } from "@/utils/settings";
import { useSettingsForm } from "../hooks/useSettingsForm";

export function VoiceSettingsSection() {
  const { voice, lang, setVoice, setLang, saveMessage, loading, save } =
    useSettingsForm();

  return (
    <section aria-labelledby="settings-heading" className="space-y-3">
      <h2 id="settings-heading" className="text-base font-semibold">
        Voice settings
      </h2>

      <Card>
        <CardContent className="pt-5">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="voice">Voice</FieldLabel>
                <Select
                  value={voice}
                  onValueChange={(value) => setVoice(value as Voice)}
                  disabled={loading}
                >
                  <SelectTrigger id="voice">
                    <SelectValue placeholder="Select voice" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Male voices</SelectLabel>
                      {MALE_VOICE_OPTIONS.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                    <SelectGroup>
                      <SelectLabel>Female voices</SelectLabel>
                      {FEMALE_VOICE_OPTIONS.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel htmlFor="lang">Language mode</FieldLabel>
                <Select
                  value={lang}
                  onValueChange={(value) => setLang(value as Lang)}
                  disabled={loading}
                >
                  <SelectTrigger id="lang">
                    <SelectValue placeholder="Select language mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fr">French</SelectItem>
                    <SelectItem value="na">Language-agnostic</SelectItem>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  French uses Supertonic&apos;s French handling. Language-agnostic
                  adapts when text may be mixed or uncertain.
                </FieldDescription>
              </Field>

              <Field>
                <Button type="submit" disabled={loading}>
                  Save settings
                </Button>
                {saveMessage ? (
                  <p
                    className="text-sm text-success"
                    role="status"
                    aria-live="polite"
                  >
                    {saveMessage}
                  </p>
                ) : null}
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
