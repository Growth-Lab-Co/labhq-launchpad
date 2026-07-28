import { Mail, PlayCircle } from "lucide-react";
import { Card } from "@/components/dashboard/Card";
import styles from "./help.module.css";

// Empty until a training video exists - set this once one's ready, the
// slot below renders itself.
const TRAINING_VIDEO_URL = "";

export default function HelpPage() {
  return (
    <>
      <h1 className={styles.heading}>Help</h1>

      <div className={styles.grid}>
        <Card>
          <div className={styles.cardInner}>
            <div className={styles.iconWrap}>
              <Mail size={20} strokeWidth={2} />
            </div>
            <p className={styles.title}>Need a hand?</p>
            <p className={styles.body}>
              Reply to any Miia email, or write to us directly and we&apos;ll get back to you.
            </p>
            <a href="mailto:bec@meetmiia.com" className={styles.link}>
              bec@meetmiia.com
            </a>
          </div>
        </Card>

        <Card>
          <div className={styles.cardInner}>
            <div className={styles.iconWrap}>
              <PlayCircle size={20} strokeWidth={2} />
            </div>
            <p className={styles.title}>Training video</p>
            {TRAINING_VIDEO_URL ? (
              <div className={styles.videoWrap}>
                <iframe
                  src={TRAINING_VIDEO_URL}
                  title="Miia training video"
                  className={styles.video}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <p className={styles.body}>Your training video isn&apos;t ready yet. We&apos;ll email you the moment it is.</p>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
