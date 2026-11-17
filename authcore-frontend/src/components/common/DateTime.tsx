import { formatDateTime, type DateInput, type FormatDateOptions } from '@/lib/format';

export interface DateTimeProps extends Omit<FormatDateOptions, 'style'> {
  value: DateInput;
  /** date · time · datetime (default) · relative ("3 hours ago", full date on hover). */
  format?: FormatDateOptions['style'];
  className?: string;
}

/**
 * A date in the user's locale (and time zone when given — pass the user's preference from
 * the profile). Renders <time dateTime> with the full date as a tooltip, also for "3 hours ago".
 */
export function DateTime({
  value,
  format = 'datetime',
  timeZone,
  locale,
  className,
}: DateTimeProps) {
  const text = formatDateTime(value, { style: format, timeZone, locale });
  if (text === '-') return <span className={className}>-</span>;
  const iso = new Date(value as string | number | Date).toISOString();
  const full = formatDateTime(value, { style: 'datetime', timeZone, locale });
  return (
    <time dateTime={iso} title={format === 'datetime' ? undefined : full} className={className}>
      {text}
    </time>
  );
}
