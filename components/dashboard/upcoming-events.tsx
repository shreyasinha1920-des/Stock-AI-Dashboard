"use client";

import { Cell } from "@/components/dashboard/cell";
import { usePortfolio, useMoney } from "@/components/portfolio/portfolio-provider";
import type { UpcomingEvent } from "@/data/portfolio";

import { cn } from "@/lib/utils";

const KIND_LABEL: Record<UpcomingEvent["kind"], string> = {
  earnings: "Earnings",
  "ex-dividend": "Ex-dividend",
  "dividend-paid": "Dividend paid",
};

export function EventRow({ event, compact = false }: { event: UpcomingEvent; compact?: boolean }) {
  const { money } = useMoney();
  const month = event.date.toLocaleDateString("en-US", { month: "short" });
  const weekday = event.date.toLocaleDateString("en-US", { weekday: "short" });
  return (
    <li className={cn("flex items-center gap-4", compact ? "h-12" : "h-14")}>
      <span className="flex w-10 shrink-0 flex-col items-center rounded-[6px] border border-hairline py-1 leading-none">
        <span className="text-[10px] text-ink-muted uppercase">{month}</span>
        <span className="num mt-0.5 text-[15px] text-ink">{event.date.getDate()}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] text-ink">
          <span className="font-medium">{event.ticker}</span>{" "}
          <span className="text-ink-2">{KIND_LABEL[event.kind]}</span>
        </span>
        <span className="block text-[12px] text-ink-muted">
          {weekday}
          {event.timing ? ` · ${event.timing}` : ""}
          {event.daysAway <= 7 ? ` · in ${event.daysAway} ${event.daysAway === 1 ? "day" : "days"}` : ""}
        </span>
      </span>
      {event.amount ? (
        <span className="num text-[13px] text-up">+{money(event.amount)}</span>
      ) : (
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-[11px]",
            event.kind === "earnings" ? "border-warn/40 text-warn" : "border-hairline text-ink-muted"
          )}
        >
          {event.kind === "earnings" ? "Volatility" : "Event"}
        </span>
      )}
    </li>
  );
}

export function UpcomingEvents() {
  const { portfolio } = usePortfolio();
  const thisWeek = portfolio.thisWeek;
  const later = portfolio.upcoming.filter((e) => e.daysAway > 7).slice(0, 4);

  return (
    <Cell className="lg:order-6 lg:col-span-6 xl:order-none xl:col-span-4" id="events" title="Upcoming events">
      <div className="flex flex-col gap-4">
        <div>
          <h3 className="eyebrow">Next 7 days</h3>
          {thisWeek.length ? (
            <ul className="mt-1 divide-y divide-hairline">
              {thisWeek.map((e) => (
                <EventRow event={e} key={`${e.ticker}-${e.kind}`} />
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[13px] text-ink-2 leading-5">
              {portfolio.hasEventsCalendar
                ? "Nothing scheduled for your holdings."
                : "No earnings or dividend calendar for Indian stocks yet. Your broker's corporate-actions page has the dates."}
            </p>
          )}
        </div>
        {later.length ? (
          <div>
            <h3 className="eyebrow">Later</h3>
            <ul className="mt-1 divide-y divide-hairline">
              {later.map((e) => (
                <EventRow compact event={e} key={`${e.ticker}-${e.kind}`} />
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </Cell>
  );
}
