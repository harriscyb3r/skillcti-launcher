export default function Reference() {
  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase mb-1">Intel Frameworks</p>
        <p className="text-[12px] text-txt-3">Core frameworks and grading systems used in threat intelligence reporting.</p>
      </div>

      <div className="flex flex-col gap-8">

        {/* ── Traffic Light Protocol ───────────────────────────────────────────── */}
        <section>
          <h2 className="text-[13px] font-bold text-txt mb-1">Traffic Light Protocol (TLP)</h2>
          <p className="text-[11px] text-txt-3 mb-4 leading-relaxed">
            TLP is a set of designations developed by FIRST to facilitate greater sharing of sensitive information.
            It tells recipients how freely they may re-share information received.
          </p>
          <div className="flex flex-col gap-2">
            {[
              {
                label: 'TLP:RED',
                color: '#ef4444',
                bg: '#ef444415',
                border: '#ef444440',
                audience: 'Named recipients only',
                description: 'Not for disclosure. Restricted to the specific individuals (or organisations) to whom it is given. Sources may use this designation when information cannot be effectively acted upon without significant risk for the privacy, reputation, or operations of the involved parties.',
              },
              {
                label: 'TLP:AMBER+STRICT',
                color: '#f97316',
                bg: '#f9731615',
                border: '#f9731640',
                audience: "Recipient's organisation only — no onward sharing",
                description: 'Limited disclosure, restricted to the recipient\'s own organisation only. Recipients may not share it with clients or partners. Stricter variant of AMBER introduced in TLP 2.0.',
              },
              {
                label: 'TLP:AMBER',
                color: '#f59e0b',
                bg: '#f59e0b15',
                border: '#f59e0b40',
                audience: "Recipient's organisation and clients on need-to-know",
                description: 'Limited disclosure, restricted to participants\' organisations and their clients. Recipients may share with clients who need to know to protect themselves. Not for public release.',
              },
              {
                label: 'TLP:GREEN',
                color: '#22c55e',
                bg: '#22c55e15',
                border: '#22c55e40',
                audience: 'Community-wide — not for public release',
                description: 'Limited disclosure, restricted to the community. May be distributed without restriction within the defined community (e.g. sector ISAC members, CERT subscribers). Not for public internet posting.',
              },
              {
                label: 'TLP:CLEAR',
                color: '#94a3b8',
                bg: '#94a3b815',
                border: '#94a3b840',
                audience: 'Unlimited — public release permitted',
                description: 'No restriction on disclosure. Subject to standard copyright rules, recipients may share this information without restriction.',
              },
            ].map((t) => (
              <div
                key={t.label}
                className="flex items-start gap-4 rounded-lg border p-4"
                style={{ background: t.bg, borderColor: t.border }}
              >
                <span
                  className="text-[10px] font-bold tracking-[0.1em] px-2 py-[5px] rounded font-mono whitespace-nowrap flex-shrink-0 mt-0.5"
                  style={{ color: t.color, background: t.color + '22', border: `1px solid ${t.color}55` }}
                >
                  {t.label}
                </span>
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-txt mb-1">{t.audience}</div>
                  <div className="text-[11px] text-txt-3 leading-relaxed">{t.description}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Admiralty Scale ──────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-[13px] font-bold text-txt mb-1">NATO Admiralty Scale</h2>
          <p className="text-[11px] text-txt-3 mb-4 leading-relaxed">
            The Admiralty Code (also called the NATO system) grades intelligence using two independent axes:
            the <span className="text-txt-2 font-medium">reliability of the source</span> (A–F) and the
            <span className="text-txt-2 font-medium"> credibility of the information</span> (1–6).
            Combined, they form a grade such as B2 or C3 that appears in intel reports.
          </p>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Source reliability */}
            <div className="bg-surface border border-border rounded-lg p-4">
              <div className="text-[11px] font-bold tracking-[0.15em] text-txt-3 uppercase mb-3">Source Reliability</div>
              <div className="flex flex-col gap-1.5">
                {[
                  { grade: 'A', label: 'Reliable', desc: 'No doubt about authenticity, trustworthiness, or competency. History of complete reliability.' },
                  { grade: 'B', label: 'Usually Reliable', desc: 'Minor doubts. Has supplied valid information in most instances.' },
                  { grade: 'C', label: 'Fairly Reliable', desc: 'Doubts about past instances but has provided valid information before.' },
                  { grade: 'D', label: 'Not Usually Reliable', desc: 'Significant doubts. Has provided valid information in the past but this is the exception.' },
                  { grade: 'E', label: 'Unreliable', desc: 'Lacks authenticity, trustworthiness, or competency. History of invalid information.' },
                  { grade: 'F', label: 'Cannot Be Judged', desc: 'Insufficient information to evaluate the source. First report from a new or unknown source.' },
                ].map(({ grade, label, desc }) => (
                  <div key={grade} className="flex items-start gap-2.5">
                    <span className="text-[11px] font-bold font-mono w-5 flex-shrink-0 text-purple mt-0.5">{grade}</span>
                    <div>
                      <span className="text-[11px] font-semibold text-txt">{label}</span>
                      <span className="text-[11px] text-txt-3 ml-2 leading-relaxed">{desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Information credibility */}
            <div className="bg-surface border border-border rounded-lg p-4">
              <div className="text-[11px] font-bold tracking-[0.15em] text-txt-3 uppercase mb-3">Information Credibility</div>
              <div className="flex flex-col gap-1.5">
                {[
                  { grade: '1', label: 'Confirmed', desc: 'Confirmed by other independent sources. Logical and consistent with other reporting on the subject.' },
                  { grade: '2', label: 'Probably True', desc: 'Not confirmed. Logical in itself, consistent with other information on the subject.' },
                  { grade: '3', label: 'Possibly True', desc: 'Not confirmed. Reasonably logical. Agrees with some other information on the subject.' },
                  { grade: '4', label: 'Doubtfully True', desc: 'Not confirmed. Possible but not logical. No other information on the subject.' },
                  { grade: '5', label: 'Improbable', desc: 'Not confirmed. Not logical in itself. Contradicted by other information on the subject.' },
                  { grade: '6', label: 'Cannot Be Judged', desc: 'No basis for evaluating the validity of the information.' },
                ].map(({ grade, label, desc }) => (
                  <div key={grade} className="flex items-start gap-2.5">
                    <span className="text-[11px] font-bold font-mono w-5 flex-shrink-0 text-cyan mt-0.5">{grade}</span>
                    <div>
                      <span className="text-[11px] font-semibold text-txt">{label}</span>
                      <span className="text-[11px] text-txt-3 ml-2 leading-relaxed">{desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Grading matrix */}
          <div className="mt-4 bg-surface border border-border rounded-lg p-4 overflow-x-auto">
            <div className="text-[11px] font-bold tracking-[0.15em] text-txt-3 uppercase mb-3">Combined Grading Matrix</div>
            <table className="w-full text-[10px] font-mono border-collapse min-w-[480px]">
              <thead>
                <tr>
                  <th className="text-left text-txt-3 font-medium pb-2 pr-4 w-28">Source \ Info</th>
                  {['1 Confirmed', '2 Probable', '3 Possible', '4 Doubtful', '5 Improbable', '6 Unknown'].map((h) => (
                    <th key={h} className="text-center text-txt-3 font-medium pb-2 px-2">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {['A Reliable', 'B Usually', 'C Fairly', 'D Not Usually', 'E Unreliable', 'F Unknown'].map((row, ri) => {
                  const letter = row[0]
                  const reliability = ri // 0=highest, 5=lowest
                  return (
                    <tr key={row}>
                      <td className="py-1 pr-4 text-txt-3 text-left">{row}</td>
                      {[0, 1, 2, 3, 4, 5].map((ci) => {
                        const score = reliability + ci
                        const opacity = score <= 2 ? '1' : score <= 5 ? '0.7' : score <= 8 ? '0.45' : '0.25'
                        const color = score <= 2 ? '#22c55e' : score <= 4 ? '#f59e0b' : score <= 7 ? '#f97316' : '#ef4444'
                        return (
                          <td key={ci} className="text-center py-1 px-2">
                            <span
                              className="inline-block px-1.5 py-0.5 rounded text-[11px] font-bold"
                              style={{ color, background: color + '20', opacity }}
                            >
                              {letter}{ci + 1}
                            </span>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="text-[11px] text-txt-3 mt-3">
              <span className="text-green font-medium">Green</span> = high-confidence grades (A1–B2). &nbsp;
              <span className="text-amber-400 font-medium">Amber</span> = usable with caveats. &nbsp;
              <span className="text-red font-medium">Red</span> = low-confidence, treat as unverified.
            </p>
          </div>
        </section>

        {/* ── Diamond Model ────────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-[13px] font-bold text-txt mb-1">Diamond Model of Intrusion Analysis</h2>
          <p className="text-[11px] text-txt-3 mb-4 leading-relaxed">
            The Diamond Model (Caltagirone, Pendergast, Betz — 2013) represents every intrusion event as a
            relationship between four core features: an <span className="text-txt-2 font-medium">Adversary</span> using a
            <span className="text-txt-2 font-medium"> Capability</span> over
            <span className="text-txt-2 font-medium"> Infrastructure</span> against a
            <span className="text-txt-2 font-medium"> Victim</span>.
            Meta-features (timestamp, phase, result, direction) annotate the event.
            Analysts chain events into activity threads and threads into activity groups for attribution.
          </p>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* SVG diagram */}
            <div className="bg-surface border border-border rounded-lg p-6 flex items-center justify-center">
              <svg viewBox="0 0 320 300" width="320" height="300" xmlns="http://www.w3.org/2000/svg">
                {/* Diamond edges */}
                <line x1="160" y1="30" x2="290" y2="150" stroke="#7c3aed" strokeWidth="1.5" strokeOpacity="0.5" />
                <line x1="290" y1="150" x2="160" y2="270" stroke="#7c3aed" strokeWidth="1.5" strokeOpacity="0.5" />
                <line x1="160" y1="270" x2="30"  y2="150" stroke="#7c3aed" strokeWidth="1.5" strokeOpacity="0.5" />
                <line x1="30"  y1="150" x2="160" y2="30"  stroke="#7c3aed" strokeWidth="1.5" strokeOpacity="0.5" />
                {/* Diagonals */}
                <line x1="30" y1="150" x2="290" y2="150" stroke="#7c3aed" strokeWidth="1" strokeOpacity="0.25" strokeDasharray="4 4" />
                <line x1="160" y1="30" x2="160" y2="270" stroke="#7c3aed" strokeWidth="1" strokeOpacity="0.25" strokeDasharray="4 4" />

                {/* Adversary — top */}
                <circle cx="160" cy="30" r="20" fill="#ef444422" stroke="#ef4444" strokeWidth="1.5" />
                <text x="160" y="34" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#ef4444">ADV</text>
                <text x="160" y="10" textAnchor="middle" fontSize="10" fill="#94a3b8">Adversary</text>

                {/* Capability — right */}
                <circle cx="290" cy="150" r="20" fill="#f59e0b22" stroke="#f59e0b" strokeWidth="1.5" />
                <text x="290" y="154" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#f59e0b">CAP</text>
                <text x="315" y="145" textAnchor="middle" fontSize="10" fill="#94a3b8">Capability</text>

                {/* Victim — bottom */}
                <circle cx="160" cy="270" r="20" fill="#22c55e22" stroke="#22c55e" strokeWidth="1.5" />
                <text x="160" y="274" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#22c55e">VIC</text>
                <text x="160" y="293" textAnchor="middle" fontSize="10" fill="#94a3b8">Victim</text>

                {/* Infrastructure — left */}
                <circle cx="30" cy="150" r="20" fill="#06b6d422" stroke="#06b6d4" strokeWidth="1.5" />
                <text x="30" y="154" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#06b6d4">INFRA</text>
                <text x="5" y="145" textAnchor="middle" fontSize="10" fill="#94a3b8">Infra</text>

                {/* Centre meta-features label */}
                <rect x="130" y="135" width="60" height="30" rx="4" fill="#1e1e2e" stroke="#7c3aed44" strokeWidth="1" />
                <text x="160" y="148" textAnchor="middle" fontSize="8" fill="#a78bfa">EVENT</text>
                <text x="160" y="159" textAnchor="middle" fontSize="7" fill="#6b7280">+ meta-features</text>

                {/* Axis labels */}
                <text x="228" y="100" textAnchor="middle" fontSize="8" fill="#7c3aed" transform="rotate(-45 228 100)">uses</text>
                <text x="228" y="210" textAnchor="middle" fontSize="8" fill="#7c3aed" transform="rotate(45 228 210)">delivers via</text>
                <text x="90" y="100" textAnchor="middle" fontSize="8" fill="#7c3aed" transform="rotate(45 90 100)">targets</text>
                <text x="90" y="210" textAnchor="middle" fontSize="8" fill="#7c3aed" transform="rotate(-45 90 210)">hosted on</text>
              </svg>
            </div>

            {/* Vertex descriptions */}
            <div className="flex flex-col gap-3">
              {[
                {
                  label: 'Adversary',
                  color: '#ef4444',
                  desc: 'The threat actor — an individual, group, or organisation believed responsible for the intrusion. May include the adversary operator (person executing the attack) and adversary customer (who benefits). Often the last feature to be attributed.',
                },
                {
                  label: 'Capability',
                  color: '#f59e0b',
                  desc: 'The tools and techniques used in the event — malware, exploits, TTPs. Maps directly to MITRE ATT&CK techniques. Capability arsenals can be tracked across events to cluster activity groups.',
                },
                {
                  label: 'Infrastructure',
                  color: '#06b6d4',
                  desc: 'Physical or logical structures the adversary uses to deliver capabilities: C2 servers, domains, IPs, email accounts, cloud resources. Type 1 is controlled by the adversary; Type 2 is third-party (e.g. compromised victim used as relay).',
                },
                {
                  label: 'Victim',
                  color: '#22c55e',
                  desc: 'The target of the intrusion — an organisation, person, or asset (host, network, data). Understanding victimology (industry, geography, size) helps predict future targeting and identify related campaigns.',
                },
              ].map(({ label, color, desc }) => (
                <div key={label} className="flex items-start gap-3 bg-surface border border-border rounded-lg p-3">
                  <span
                    className="text-[11px] font-bold tracking-[0.1em] uppercase px-2 py-[4px] rounded flex-shrink-0 mt-0.5"
                    style={{ color, background: color + '20', border: `1px solid ${color}44` }}
                  >
                    {label}
                  </span>
                  <p className="text-[11px] text-txt-3 leading-relaxed">{desc}</p>
                </div>
              ))}

              <div className="bg-surface border border-border rounded-lg p-3">
                <div className="text-[11px] font-bold tracking-[0.12em] text-txt-3 uppercase mb-2">Meta-features</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {[
                    ['Timestamp', 'When the event occurred'],
                    ['Phase', 'Kill chain stage'],
                    ['Result', 'Success / Failure / Unknown'],
                    ['Direction', 'Attack vector direction'],
                    ['Methodology', 'Attack category'],
                    ['Resources', 'What the adversary needed'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex gap-1.5 text-[11px]">
                      <span className="text-purple font-medium flex-shrink-0">{k}:</span>
                      <span className="text-txt-3">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Cyber Kill Chain ────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-[13px] font-bold text-txt mb-1">Cyber Kill Chain</h2>
          <p className="text-[11px] text-txt-3 mb-4 leading-relaxed">
            The Lockheed Martin Cyber Kill Chain (2011) describes the seven sequential stages of a targeted intrusion.
            Defenders can break the chain at any stage to stop an attack. Earlier disruption is more cost-effective.
          </p>
          <div className="relative">
            {/* Arrow track */}
            <div className="flex items-stretch gap-0 overflow-x-auto pb-1">
              {[
                { num: '1', label: 'Reconnaissance', color: '#94a3b8', desc: 'Research targets. OSINT, scanning, social media.' },
                { num: '2', label: 'Weaponisation', color: '#a78bfa', desc: 'Create malware or exploit paired with a delivery mechanism.' },
                { num: '3', label: 'Delivery', color: '#818cf8', desc: 'Transmit weapon: phishing email, USB, watering hole.' },
                { num: '4', label: 'Exploitation', color: '#f59e0b', desc: 'Trigger code execution on the target system.' },
                { num: '5', label: 'Installation', color: '#f97316', desc: 'Install backdoor or persistent implant on target.' },
                { num: '6', label: 'C2', color: '#ef4444', desc: 'Establish command-and-control channel.' },
                { num: '7', label: 'Actions on Objectives', color: '#dc2626', desc: 'Execute the mission: exfil, ransomware, destruction.' },
              ].map((stage, i, arr) => (
                <div key={stage.num} className="flex items-stretch flex-1 min-w-[100px]">
                  <div
                    className="flex-1 flex flex-col gap-1 p-3 rounded-lg border text-center"
                    style={{ background: stage.color + '12', borderColor: stage.color + '40' }}
                  >
                    <div className="text-[10px] font-bold font-mono" style={{ color: stage.color }}>
                      {stage.num}
                    </div>
                    <div className="text-[11px] font-bold text-txt leading-tight">{stage.label}</div>
                    <div className="text-[11px] text-txt-3 leading-relaxed hidden sm:block">{stage.desc}</div>
                  </div>
                  {i < arr.length - 1 && (
                    <div className="flex items-center px-1 flex-shrink-0 text-txt-3 text-[11px]">›</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── MITRE ATLAS ─────────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-[13px] font-bold text-txt mb-1">MITRE ATLAS</h2>
          <p className="text-[11px] text-txt-3 mb-4 leading-relaxed">
            MITRE ATLAS (Adversarial Threat Landscape for AI Systems) is a knowledge base of adversary tactics
            and techniques against machine learning systems, structured like ATT&amp;CK. It covers attacks on
            ML models at every stage — from reconnaissance through to impact — including classical ML and
            large language models. Use it to threat-model AI/ML pipelines and map detection gaps.
          </p>

          {/* Tactics row */}
          <div className="flex items-stretch gap-0 overflow-x-auto pb-1 mb-4">
            {[
              { id: 'AML.TA00', label: 'Reconnaissance', color: '#94a3b8', desc: 'Gather information about the target ML system, APIs, and training data.' },
              { id: 'AML.TA01', label: 'Resource Dev', color: '#a78bfa', desc: 'Acquire infrastructure, data, or model access for staging attacks.' },
              { id: 'AML.TA02', label: 'Initial Access', color: '#818cf8', desc: 'Gain initial access to ML assets via APIs, supply chain, or insider.' },
              { id: 'AML.TA03', label: 'Attack Staging', color: '#f59e0b', desc: 'Prepare adversarial inputs, poisoned data, or backdoor artefacts.' },
              { id: 'AML.TA04', label: 'Exfiltration', color: '#f97316', desc: 'Extract model weights, training data, or inferred private records.' },
              { id: 'AML.TA05', label: 'Impact', color: '#ef4444', desc: 'Degrade model performance, inject persistent backdoors, or cause harm.' },
            ].map((tactic, i, arr) => (
              <div key={tactic.id} className="flex items-stretch flex-1 min-w-[100px]">
                <div
                  className="flex-1 flex flex-col gap-1 p-3 rounded-lg border text-center"
                  style={{ background: tactic.color + '12', borderColor: tactic.color + '40' }}
                >
                  <div className="text-[10px] font-bold font-mono" style={{ color: tactic.color }}>{tactic.id}</div>
                  <div className="text-[11px] font-bold text-txt leading-tight">{tactic.label}</div>
                  <div className="text-[11px] text-txt-3 leading-relaxed hidden sm:block">{tactic.desc}</div>
                </div>
                {i < arr.length - 1 && (
                  <div className="flex items-center px-1 flex-shrink-0 text-txt-3 text-[11px]">›</div>
                )}
              </div>
            ))}
          </div>

          {/* Key technique categories */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              {
                label: 'Model Evasion',
                color: '#f59e0b',
                techniques: ['Crafted adversarial inputs', 'Black-box / white-box attacks', 'Transferability exploitation'],
                desc: 'Crafting inputs that cause a model to misclassify or produce incorrect outputs without access to model internals (black-box) or with full access (white-box).',
              },
              {
                label: 'Data Poisoning',
                color: '#ef4444',
                techniques: ['Training data injection', 'Backdoor embedding', 'Label flipping'],
                desc: 'Corrupting the training dataset to degrade model performance, embed a hidden backdoor trigger, or bias outputs toward an adversary-controlled class.',
              },
              {
                label: 'Model Inversion & Inference',
                color: '#a78bfa',
                techniques: ['Membership inference', 'Model inversion', 'Property inference'],
                desc: 'Recovering training data, determining whether a specific record was in the training set, or inferring sensitive properties of the training distribution from model outputs.',
              },
              {
                label: 'Prompt Injection (LLMs)',
                color: '#06b6d4',
                techniques: ['Direct prompt injection', 'Indirect / RAG injection', 'Jailbreaking'],
                desc: 'Supplying instructions in user input or retrieved content that override the system prompt, hijack the model\'s behaviour, or cause it to ignore safety guardrails.',
              },
              {
                label: 'Model Theft',
                color: '#22c55e',
                techniques: ['Query-based extraction', 'Distillation attacks', 'Weight exfiltration'],
                desc: 'Reconstructing a functional copy of a proprietary model by querying its API, using the responses to train a surrogate, or directly exfiltrating model weights.',
              },
              {
                label: 'Supply Chain Compromise',
                color: '#f97316',
                techniques: ['Poisoned pre-trained model', 'Malicious ML library', 'Dataset tampering'],
                desc: 'Injecting malicious artefacts into third-party model hubs, ML frameworks, or shared datasets that are consumed downstream by the target organisation.',
              },
            ].map(({ label, color, techniques, desc }) => (
              <div key={label} className="bg-surface border border-border rounded-lg p-3 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className="text-[11px] font-bold tracking-[0.08em] uppercase px-2 py-[3px] rounded flex-shrink-0"
                    style={{ color, background: color + '20', border: `1px solid ${color}44` }}
                  >
                    {label}
                  </span>
                </div>
                <p className="text-[11px] text-txt-3 leading-relaxed">{desc}</p>
                <div className="flex flex-wrap gap-1">
                  {techniques.map((t) => (
                    <span key={t} className="text-[11px] text-txt-3 bg-surface2 border border-border px-1.5 py-[2px] rounded">{t}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── OWASP Agentic AI Top 10 ──────────────────────────────────────────── */}
        <section>
          <h2 className="text-[13px] font-bold text-txt mb-1">OWASP Agentic AI Top 10</h2>
          <p className="text-[11px] text-txt-3 mb-4 leading-relaxed">
            The OWASP Agentic AI Security Top 10 (2025) identifies the most critical security risks in
            autonomous AI agent systems — pipelines where an LLM can plan, call tools, and take actions
            with limited human oversight. The list complements the OWASP LLM Top 10 and focuses on
            risks that emerge specifically from autonomy, tool use, and multi-agent composition.
          </p>
          <div className="flex flex-col gap-2">
            {[
              {
                id: 'AA01',
                label: 'Prompt Injection',
                severity: 'CRITICAL',
                color: '#ef4444',
                desc: 'Adversarial content in user input, retrieved documents, or tool responses overrides the system prompt and hijacks agent behaviour. Indirect injection via RAG or web fetch is the most dangerous variant in agentic systems because the agent acts on the injected instruction without user awareness.',
              },
              {
                id: 'AA02',
                label: 'Excessive Agency',
                severity: 'CRITICAL',
                color: '#ef4444',
                desc: 'Agents are granted more permissions, tools, or autonomy than needed for the task. Over-privileged agents amplify the blast radius of any compromise — a single injected instruction can trigger file deletion, email exfiltration, or lateral movement through connected APIs.',
              },
              {
                id: 'AA03',
                label: 'Unsafe Tool Use',
                severity: 'HIGH',
                color: '#f97316',
                desc: 'Agents execute tool calls (shell commands, API requests, database queries) without input validation, output sanitisation, or confirmation gates. Attackers can craft inputs that cause an agent to run arbitrary code, perform unintended writes, or leak data through tool return values.',
              },
              {
                id: 'AA04',
                label: 'Privilege Escalation',
                severity: 'HIGH',
                color: '#f97316',
                desc: 'An agent operating at a low privilege level is manipulated into invoking a higher-privileged tool, sub-agent, or API endpoint, gaining capabilities beyond its intended scope. Common in multi-agent architectures where orchestrators and sub-agents run at different trust levels.',
              },
              {
                id: 'AA05',
                label: 'Sensitive Data Exposure',
                severity: 'HIGH',
                color: '#f97316',
                desc: 'Agents surface confidential data — PII, credentials, internal documents — through responses, logs, or tool outputs. Risks include cross-user context leakage in multi-tenant deployments, tool responses that echo back secrets, and long-context memory carrying prior session data.',
              },
              {
                id: 'AA06',
                label: 'Resource Exhaustion',
                severity: 'MEDIUM',
                color: '#f59e0b',
                desc: 'Unbounded agent loops, recursive sub-agent spawning, or adversarially crafted tasks cause uncontrolled consumption of tokens, API calls, compute, or cost. Affects both availability and cost — a single malicious prompt can trigger thousands of downstream API calls.',
              },
              {
                id: 'AA07',
                label: 'Cascading Agent Compromise',
                severity: 'HIGH',
                color: '#f97316',
                desc: 'In multi-agent pipelines, a compromised or manipulated sub-agent passes malicious outputs upstream, poisoning orchestrator state and propagating the attack through the entire pipeline. Trust between agents is often implicit rather than cryptographically enforced.',
              },
              {
                id: 'AA08',
                label: 'Inadequate Human Oversight',
                severity: 'MEDIUM',
                color: '#f59e0b',
                desc: 'Agents perform irreversible or high-impact actions (send email, delete records, execute payments) without requiring human approval. Missing kill switches, approval gates, or audit trails mean errors and attacks go undetected or cannot be rolled back.',
              },
              {
                id: 'AA09',
                label: 'Agent Memory Poisoning',
                severity: 'MEDIUM',
                color: '#f59e0b',
                desc: 'Attackers inject malicious content into an agent\'s persistent memory, vector store, or knowledge base. Poisoned memories influence future reasoning and actions across sessions — effectively a persistent backdoor that survives context resets.',
              },
              {
                id: 'AA10',
                label: 'Trust Boundary Violations',
                severity: 'MEDIUM',
                color: '#f59e0b',
                desc: 'Agents pass data or control across trust boundaries — between user and system context, between internal and external tools, or between agents with different privilege levels — without re-validation. Enables confused deputy attacks and cross-context data leakage.',
              },
            ].map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-4 rounded-lg border p-4"
                style={{ background: item.color + '0d', borderColor: item.color + '30' }}
              >
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  <span
                    className="text-[10px] font-bold tracking-[0.1em] px-2 py-[4px] rounded font-mono"
                    style={{ color: item.color, background: item.color + '22', border: `1px solid ${item.color}55` }}
                  >
                    {item.id}
                  </span>
                  <span
                    className="text-[11px] font-bold tracking-[0.08em] uppercase"
                    style={{ color: item.color }}
                  >
                    {item.severity}
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-txt mb-1">{item.label}</div>
                  <div className="text-[11px] text-txt-3 leading-relaxed">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  )
}
