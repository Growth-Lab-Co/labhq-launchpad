import { StatGrid } from "./StatGrid";
import { ConversationHero } from "./ConversationHero";
import { BookingsList } from "./BookingsList";
import { RevenueCard } from "./RevenueCard";
import { ActivityFeed } from "./ActivityFeed";
import { ChannelsCard } from "./ChannelsCard";
import styles from "./DashboardHome.module.css";

// Every Miia tenant is an Australian business, currently always on the
// Sunshine Coast/Brisbane timezone - server time (Netlify runs in UTC) was
// producing "Good morning" in the middle of the Australian afternoon.
// Morning: before 12. Afternoon: 12 up to 5pm. Evening: 5pm on.
const TENANT_TIMEZONE = "Australia/Brisbane";

function timeOfDayGreeting() {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: TENANT_TIMEZONE, hour: "2-digit", hour12: false }).formatToParts(
    new Date()
  );
  // Some Intl implementations report midnight as "24" rather than "00" with
  // hour12:false - normalise back into 0-23 rather than let that read as
  // "Good evening" at midnight.
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function DashboardHome({ tenant, deployment, businessName, contactFirstName, data, channelsData, base }) {
  return (
    <>
      <div>
        <h1 className={styles.greeting}>
          {timeOfDayGreeting()}
          {contactFirstName ? `, ${contactFirstName}` : ""}
        </h1>
        <p className={styles.sub}>Here&apos;s what Miia has handled for {businessName} today.</p>
      </div>

      <StatGrid stats={data.stats} />

      <div className={styles.columns}>
        <div className={styles.col}>
          <ConversationHero conversation={data.latestConversation} tenantSlug={tenant.slug} widgetKey={tenant.widgetKey} base={base} />
          <BookingsList bookings={data.bookingsTodayList} />
          <RevenueCard
            afterHoursBookingsThisMonth={data.revenueProtected?.afterHoursBookings}
            avgAppointmentValue={data.revenueProtected?.avgAppointmentValue}
          />
        </div>
        <div className={styles.col}>
          <ActivityFeed entries={data.activity} />
          <ChannelsCard channels={channelsData.channels} base={base} />
        </div>
      </div>
    </>
  );
}
