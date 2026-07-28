import { StatGrid } from "./StatGrid";
import { ConversationHero } from "./ConversationHero";
import { BookingsList } from "./BookingsList";
import { RevenueCard } from "./RevenueCard";
import { ActivityFeed } from "./ActivityFeed";
import { ChannelsCard } from "./ChannelsCard";
import styles from "./DashboardHome.module.css";

function timeOfDayGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
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
          <ConversationHero conversation={data.latestConversation} tenantSlug={tenant.slug} base={base} />
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
