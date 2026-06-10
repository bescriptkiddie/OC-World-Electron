const { useEffect, useState, useCallback } = React;

const bootLines = [
  "CONNECT WALLET HANDSHAKE",
  "CHARACTER PASSPORT READY",
  "MEMORY VAULT HASHED",
  "NFT OWNERSHIP LAYER ARMED",
  "PORTABILITY ROUTE OPEN"
];

function TopBar({ onLaunchApp }) {
  return (
    <header className="topbar">
      <a className="brand" href="#top" aria-label="ZEALWISH home">ZEALWISH</a>
      <nav className="nav" aria-label="Primary navigation">
        <a href="#create">Create</a>
        <a href="#web3">Web3</a>
        <a href="#memory">Memory</a>
        <a href="#ownership">Ownership</a>
        <a href="#worlds">Worlds</a>
      </nav>
      <button className="wallet-button edge" onClick={() => onLaunchApp('home')}>Launch App</button>
    </header>
  );
}

function BootLog() {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (shown >= bootLines.length) return undefined;
    const timer = setTimeout(() => setShown(shown + 1), 360);
    return () => clearTimeout(timer);
  }, [shown]);

  return (
    <div className="system-panel edge">
      <h3 className="mono">Character Kernel</h3>
      {bootLines.slice(0, shown).map((line, index) => (
        <p className="mono" key={line}><span style={{ color: "var(--red)" }}>0{index}</span> / {line}</p>
      ))}
      {shown < bootLines.length && <p className="mono" style={{ color: "var(--red)" }}>awaiting signal...</p>}
    </div>
  );
}

function Web3Rail() {
  const nodes = [
    ["WALLET", "Connect wallet", "User-owned account"],
    ["AI", "Create character", "Personality and voice"],
    ["NFT", "Mint passport", "Identity and provenance"],
    ["WORLD", "Carry across worlds", "Games, agents, creators"]
  ];

  return (
    <div className="web3-rail" aria-label="Web3 ownership flow">
      {nodes.map(([code, title, body]) => (
        <div className="rail-node" key={code}>
          <span className="rail-code mono">{code}</span>
          <b>{title}</b>
          <small>{body}</small>
        </div>
      ))}
    </div>
  );
}

function Hero({ onLaunchApp }) {
  return (
    <section id="top" className="hero">
      <div className="hero-copy">
        <div className="kicker mono">Wallet-owned AI character / NFT identity passport</div>
        <h1>ZEALWISH</h1>
        <h2 aria-label="Create. Grow. Own your AI character.">Create. Grow. <span>Own</span> your AI character.</h2>
        <p>
          Free will for your digital self. Connect a wallet, create a living AI companion, and shape a character passport that anchors identity, memory, and relationship continuity on-chain without turning the character into speculation.
        </p>
        <div className="actions">
          <button className="primary-button edge" onClick={() => onLaunchApp('create')}>Create Character Passport</button>
          <a className="secondary-button edge" href="#web3">Explore Web3 Layer</a>
        </div>
        <div className="signal-strip mono" aria-label="Product pillars">
          <div><strong>01</strong><span>Wallet login</span></div>
          <div><strong>02</strong><span>AI character</span></div>
          <div><strong>03</strong><span>Memory-backed NFT</span></div>
          <div><strong>04</strong><span>Cross-world passport</span></div>
        </div>
        <Web3Rail />
      </div>

      <div className="character-stage" aria-label="ZEALWISH character preview">
        <div className="frame edge" />
        <div className="character-card">
          <div className="character-tag mono edge">OC-0001 / Alive</div>
          <img src="assets/zealwish-main-character.png" alt="ZEALWISH red signal AI character" />
          <BootLog />
        </div>
      </div>
    </section>
  );
}

function Ticker() {
  const words = ["Wallet", "AI Character", "NFT Passport", "Memory Vault", "Blockchain Anchor", "Own", "Carry", "Evolve"];
  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker-track mono">
        {[...words, ...words, ...words, ...words].map((word, index) => (
          <span key={`${word}-${index}`}><b>ZEALWISH</b> / {word}</span>
        ))}
      </div>
    </div>
  );
}

function Web3IntroSection() {
  const cards = [
    ["01 / Wallet", "Wallet-Owned Identity", "The user begins with a wallet-controlled account, not another platform-locked profile trapped inside one app."],
    ["02 / NFT", "Character Passport NFT", "A unique token can represent the AI character's identity, provenance, permissions, and future creator assets."],
    ["03 / Memory", "Memory Vault", "Important relationship memories can stay private off-chain while hashes, permissions, and ownership proofs preserve continuity."],
    ["04 / Chain", "Blockchain Anchor", "The chain is the neutral ownership layer that helps a character move into games, agent tools, and creator worlds."]
  ];

  return (
    <section id="web3" className="section ownership-thesis">
      <div className="thesis-panel edge">
        <div className="thesis-copy">
          <div className="tag mono">Built for ownership, not speculation</div>
          <h2>A wallet-owned character, not another platform-locked chatbot.</h2>
          <p>
            The Web3 story is simple: wallet, NFT, and blockchain are ownership infrastructure. They clarify who controls the character, how identity can be verified, and how memory continuity can survive beyond one platform.
          </p>
        </div>
        <div className="thesis-grid">
          {cards.map(([code, title, body]) => (
            <article className="thesis-card" key={code}>
              <div className="code mono">{code}</div>
              <h3 className="display">{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Feature({ index, title, children }) {
  return (
    <article className="feature">
      <div className="feature-index mono">0{index}</div>
      <div>
        <h3 className="display">{title}</h3>
        <p>{children}</p>
      </div>
    </article>
  );
}

function CreateSection() {
  return (
    <section id="create" className="section">
      <div className="section-heading">
        <div className="eyebrow mono">For every person, not one niche</div>
        <h2>Not a productivity bot. A character life system.</h2>
        <p>
          The best AI companion products prove one thing: people return for presence, memory, and personality. ZEALWISH adds the missing layer: the character can belong to the user's wallet, not the platform database.
        </p>
      </div>
      <div className="feature-grid">
        <Feature index="1" title="Create Your OC">
          Design a character with a visual identity, personality, voice, and origin. Start from a prompt, then shape the being through interaction.
        </Feature>
        <Feature index="2" title="Grow Through Memory">
          Conversations, moments, preferences, rituals, and emotional context become a relationship timeline instead of disposable chat history.
        </Feature>
        <Feature index="3" title="Own the Identity">
          The character identity can become a wallet-linked passport, backed up by an ownership token and carried across future apps, worlds, games, and creator experiences.
        </Feature>
      </div>
    </section>
  );
}

function Step({ number, title, children }) {
  return (
    <article className="step edge">
      <div className="number display">{number}</div>
      <h3>{title}</h3>
      <p>{children}</p>
    </article>
  );
}

function MemorySection() {
  return (
    <section id="memory" className="section">
      <div className="section-heading">
        <div className="eyebrow mono">Memory creates continuity</div>
        <h2>A companion becomes real when it remembers.</h2>
        <p>
          ZEALWISH turns memory into the emotional spine of the product: what happened, what changed, what your character learned, and why the bond keeps growing.
        </p>
      </div>
      <div className="flow">
        <Step number="01" title="Seed">
          Choose a visual style, personality direction, and origin signal for your first OC.
        </Step>
        <Step number="02" title="Talk">
          Build a relationship through daily conversations, quiet check-ins, and shared moments.
        </Step>
        <Step number="03" title="Remember">
          Important memories become a structured vault, not a lost scroll of old chats.
        </Step>
        <Step number="04" title="Carry">
          Your character identity can move into new platforms, games, and creator worlds.
        </Step>
      </div>
    </section>
  );
}

function OwnershipSection() {
  const items = [
    ["WALLET", "Wallet-Owned Identity", "A user-controlled wallet becomes the entry point for an AI character profile with visual traits, personality, provenance, and relationship state."],
    ["NFT", "Character Passport NFT", "NFT is not the product. Ownership is. The passport represents the right to carry the character identity forward."],
    ["CHAIN", "Blockchain Anchor", "Identity proofs, creator provenance, and permission records can live on neutral rails instead of a single platform database."],
    ["MEM", "Memory Vault", "Selective memories can be backed up as durable records, preserving continuity beyond one app while keeping private data protected."]
  ];
  return (
    <section id="ownership" className="section ownership">
      <div className="quote-panel edge">
        <h2 className="display">NFT is not the product. Ownership is.</h2>
        <p>
          When an AI character holds your memories, taste, relationship history, and digital identity, the wallet should prove continuity and control instead of locking the relationship inside one company forever.
        </p>
      </div>
      <div className="protocol-list">
        {items.map(([code, title, body]) => (
          <article className="protocol-item edge" key={code}>
            <div className="label mono">{code}</div>
            <div className="copy">
              <h3>{title}</h3>
              <p>{body}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function WorldsSection() {
  return (
    <section id="worlds" className="section">
      <div className="section-heading">
        <div className="eyebrow mono">Creator market and future worlds</div>
        <h2>Characters should travel farther than one chat window.</h2>
        <p>
          ZEALWISH starts with companion creation and memory, then expands toward creator skins, playable personalities, interoperable agents, and community-made character worlds.
        </p>
      </div>
      <div className="market-grid">
        <div className="memory-ledger edge">
          <div className="ledger-row mono"><time>DAY 001</time><strong>OC identity generated</strong><span>created</span></div>
          <div className="ledger-row mono"><time>DAY 027</time><strong>First relationship milestone unlocked</strong><span>memory</span></div>
          <div className="ledger-row mono"><time>DAY 042</time><strong>Creator skin attached to character profile</strong><span>market</span></div>
          <div className="ledger-row mono"><time>DAY 100</time><strong>Portable identity exported to a new world</strong><span>future</span></div>
        </div>
        <aside className="creator-card edge">
          <h3 className="display">Built for players, creators, collectors, and companion users.</h3>
          <p>
            The audience is broad by design: game players, virtual character fans, creators, collectors, and anyone who wants a long-term AI companion that feels personally theirs.
          </p>
          <div className="mini-grid">
            <div className="mini-tile"><b>Players</b>Bring an OC into game-like worlds.</div>
            <div className="mini-tile"><b>Creators</b>Publish styles, skins, scenes, and lore.</div>
            <div className="mini-tile"><b>Companions</b>Build continuity through memory.</div>
            <div className="mini-tile"><b>Collectors</b>Own identity, not just media.</div>
          </div>
        </aside>
      </div>
    </section>
  );
}

function FinalCTA({ onLaunchApp }) {
  return (
    <section className="final-cta">
      <div>
        <h2 className="display">Your AI. Your memory. Your will.</h2>
        <p>
          ZEALWISH is a living character platform for the next generation of wallet-owned AI companions, memory-backed NFTs, digital identity, and user-owned worlds.
        </p>
        <div className="actions">
          <button className="primary-button edge" onClick={() => onLaunchApp('create')}>Create Your Character</button>
          <a className="secondary-button edge" href="#ownership">View ownership layer</a>
        </div>
      </div>
    </section>
  );
}

function App() {
  const [showApp, setShowApp] = useState(false);

  const handleLaunchApp = useCallback((intent = 'home') => {
    setShowApp(true);
    // After landing hides, mount the v4 app shell into a new container
    setTimeout(() => {
      const appContainer = document.getElementById('zealwish-app');
      if (appContainer && typeof window.ZEALWISH_MOUNT_APP === 'function') {
        window.ZEALWISH_MOUNT_APP(appContainer, { intent });
      }
    }, 100);
  }, []);

  if (showApp) {
    return (
      <div id="zealwish-app" style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'var(--bg-base)',
        animation: 'fade-in 0.5s ease-out',
      }} />
    );
  }

  return (
    <main className="shell">
      <TopBar onLaunchApp={handleLaunchApp} />
      <Hero onLaunchApp={handleLaunchApp} />
      <Ticker />
      <Web3IntroSection />
      <CreateSection />
      <MemorySection />
      <OwnershipSection />
      <WorldsSection />
      <FinalCTA onLaunchApp={handleLaunchApp} />
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
