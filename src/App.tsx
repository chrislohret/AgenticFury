import {
  Card,
  Divider,
  Subtitle1,
  Text,
  Title1,
  Title3,
  makeStyles,
  tokens,
} from '@fluentui/react-components';

// Celebratory launch screen — shown immediately after a successful `pac code push`.
// Replace this file once you start building your real app. The golden path:
//   Plan → Prototype → Connect → Deploy → Iterate
const useStyles = makeStyles({
  root: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorNeutralBackground1,
    paddingTop: tokens.spacingVerticalXXL,
    paddingBottom: tokens.spacingVerticalXXL,
    paddingLeft: tokens.spacingHorizontalXXL,
    paddingRight: tokens.spacingHorizontalXXL,
    gap: tokens.spacingVerticalXXL,
    boxSizing: 'border-box',
  },
  hero: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: tokens.spacingVerticalM,
    maxWidth: '680px',
  },
  // Bouncy entrance animation for the party-popper emoji
  burst: {
    fontSize: '72px',
    lineHeight: '1',
    display: 'block',
    animationName: {
      '0%': { transform: 'scale(0.5) rotate(-10deg)', opacity: '0' },
      '60%': { transform: 'scale(1.25) rotate(4deg)', opacity: '1' },
      '80%': { transform: 'scale(0.95) rotate(-2deg)' },
      '100%': { transform: 'scale(1) rotate(0deg)', opacity: '1' },
    },
    animationDuration: '0.9s',
    animationFillMode: 'both',
    animationTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  appName: {
    color: tokens.colorBrandForeground1,
  },
  tagline: {
    color: tokens.colorNeutralForeground2,
    maxWidth: '520px',
  },
  // Pill that summarises the full delivery loop
  goldenPath: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacingHorizontalS,
    backgroundColor: tokens.colorBrandBackground2,
    borderRadius: tokens.borderRadiusXLarge,
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
  },
  step: {
    color: tokens.colorBrandForeground1,
    fontWeight: tokens.fontWeightSemibold,
  },
  arrow: {
    color: tokens.colorNeutralForeground4,
  },
  // Two "what's next" cards — idea-first and data-first paths
  paths: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: tokens.spacingHorizontalL,
    width: '100%',
    maxWidth: '800px',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    padding: tokens.spacingHorizontalXL,
    borderRadius: tokens.borderRadiusXLarge,
    boxShadow: tokens.shadow16,
  },
  cardHead: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  cardEmoji: {
    fontSize: '32px',
    lineHeight: '1',
  },
  cardBody: {
    color: tokens.colorNeutralForeground2,
  },
  // Styled block for the suggested agent prompt
  prompt: {
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    borderLeftStyle: 'solid',
    borderLeftWidth: '3px',
    borderLeftColor: tokens.colorBrandStroke1,
  },
  promptLabel: {
    display: 'block',
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
    marginBottom: tokens.spacingVerticalXS,
  },
  promptText: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorBrandForeground1,
  },
  divider: {
    width: '100%',
    maxWidth: '800px',
  },
  footer: {
    color: tokens.colorNeutralForeground3,
    textAlign: 'center',
    maxWidth: '520px',
  },
});

export function App() {
  const styles = useStyles();

  return (
    <div className={styles.root}>
      {/* ── Hero ── */}
      <div className={styles.hero}>
        <span className={styles.burst} role="img" aria-label="Party popper">
          🎉
        </span>
        <Title1 as="h1">
          <span className={styles.appName}>AgenticFury App</span> is live!
        </Title1>
        <Subtitle1 as="p" className={styles.tagline}>
          You just deployed a real Power Apps Code App to Dataverse. That is not a demo —
          that is a production-grade Microsoft 365 integration running on your tenant. Take a
          moment to appreciate what you just shipped.
        </Subtitle1>

        {/* Golden-path delivery loop */}
        <div className={styles.goldenPath} role="list" aria-label="The golden path">
          <Text className={styles.step}>📋 Plan</Text>
          <Text className={styles.arrow}>→</Text>
          <Text className={styles.step}>🖼️ Prototype</Text>
          <Text className={styles.arrow}>→</Text>
          <Text className={styles.step}>🔌 Connect</Text>
          <Text className={styles.arrow}>→</Text>
          <Text className={styles.step}>🚀 Deploy</Text>
          <Text className={styles.arrow}>→</Text>
          <Text className={styles.step}>🔁 Iterate</Text>
        </div>
      </div>

      {/* ── Next-step paths ── */}
      <div className={styles.paths}>
        {/* Path A: idea-first */}
        <Card className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardEmoji}>🧠</span>
            <Title3>Start with an idea</Title3>
          </div>
          <Text className={styles.cardBody}>
            You have a business problem in mind but have not modelled the data yet. Return to
            VS Code, open your code agent, and describe what you want to build. It will walk
            you through the plan → prototype → connect loop so you validate the UX before
            touching Dataverse.
          </Text>
          <div className={styles.prompt}>
            <span className={styles.promptLabel}>Try asking your agent:</span>
            <Text className={styles.promptText}>
              "I want to build [describe your app]. Help me plan it as a Power Apps Code App
              and take me through the golden path."
            </Text>
          </div>
        </Card>

        {/* Path B: data-first */}
        <Card className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardEmoji}>📊</span>
            <Title3>Start with your data</Title3>
          </div>
          <Text className={styles.cardBody}>
            Already have a Dataverse schema, an Excel workbook, or a data model sketched out?
            Hand it to your code agent. It can reverse-engineer the structure into a planning
            payload, generate a prototype, and get you to a working first pass faster than
            starting from scratch.
          </Text>
          <div className={styles.prompt}>
            <span className={styles.promptLabel}>Try asking your agent:</span>
            <Text className={styles.promptText}>
              "Here is my existing schema / Excel file. Examine the data structures and
              generate a first-pass planning payload, then take me through prototyping it as a
              Code App."
            </Text>
          </div>
        </Card>
      </div>

      <Divider className={styles.divider} />

      <Text className={styles.footer}>
        Every iteration brings you back here. This screen is your pitstop, not your finish
        line. 🏁
      </Text>
    </div>
  );
}
