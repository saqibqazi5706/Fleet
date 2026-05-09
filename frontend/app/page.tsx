'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

const SHIPS = [
  { id: 'MV-1', name: 'Aurora', cargo: 'Crude Oil', status: 'normal' as const },
  { id: 'MV-3', name: 'Cygnus', cargo: 'LNG', status: 'normal' as const },
  { id: 'MV-6', name: 'Falcon', cargo: 'Containers', status: 'normal' as const },
  { id: 'MV-11', name: 'Kite', cargo: 'LNG', status: 'normal' as const },
  { id: 'MV-15', name: 'Orca', cargo: 'Crude Oil', status: 'normal' as const },
]

const FEATURES = [
  { icon: '⚡', label: '1Hz Live Telemetry', desc: 'Positions broadcast every second via Socket.IO to all connected stations with smooth interpolation' },
  { icon: '🗺️', label: 'Restricted Zone Drawing', desc: 'Command draws polygons on Mapbox; backend detects geofence breaches instantly with AI validation' },
  { icon: '🤖', label: 'Claude AI Distress Parser', desc: 'Escalated distress messages parsed by Claude Sonnet into actionable structured data with severity scoring' },
  { icon: '📡', label: 'Directive System', desc: 'Command issues HOLD / REROUTE / CHANGE DESTINATION; captains accept or escalate in real-time' },
  { icon: '⛽', label: 'Fuel & Weather Physics', desc: 'Realistic fuel burn with 1.3× adverse-weather multiplier from live Open-Meteo API integration' },
  { icon: '📼', label: 'Playback Snapshots', desc: 'Rewind fleet state up to 1 hour in 30-second increments with smooth time-scrubbing' },
  { icon: '🚨', label: 'Multi-Level Alerting', desc: 'Geofence breaches, proximity warnings, stranded detection, fuel threshold alerts with severity levels' },
  { icon: '🎯', label: 'Precision Targeting', desc: 'Sub-meter positioning accuracy with heading-relative ship icons and dynamic status coloring' },
]

const ROLES = [
  {
    badge: '🎯 COMMAND CENTER',
    title: 'Fleet Command',
    desc: 'Full situational awareness. Monitor all vessels, draw restricted zones, issue directives, review AI distress analysis, and scrub playback history.',
    features: ['Full fleet map view', 'Zone creation tools', 'Directive composer', 'AI distress reports', 'Alert management', 'Playback scrubber'],
    href: '/command',
    cta: 'Open Command',
    variant: 'command' as const,
  },
  {
    badge: '⚓ VESSEL CAPTAIN',
    title: 'Captain Station',
    desc: 'Assigned vessel view. Receive directives from Command, accept or escalate to distress. Submit emergency distress signals parsed by Claude AI.',
    features: ['Own vessel telemetry', 'Fleet position overview', 'Directive inbox', 'Accept / Escalate', 'Manual distress signal', 'Zone visibility'],
    href: '/captain/MV-3',
    cta: 'Captain View',
    variant: 'captain' as const,
  },
]

export default function LandingPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [tick, setTick] = useState(0)
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 })

  // Animated radar canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let angle = 0
    let animId = 0

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Static ship dots on the radar
    const dots = [
      { x: 0.52, y: 0.44 }, { x: 0.61, y: 0.57 }, { x: 0.38, y: 0.62 },
      { x: 0.48, y: 0.71 }, { x: 0.55, y: 0.38 }, { x: 0.42, y: 0.50 },
      { x: 0.65, y: 0.45 }, { x: 0.35, y: 0.48 }, { x: 0.58, y: 0.65 },
      { x: 0.44, y: 0.35 }, { x: 0.70, y: 0.58 }, { x: 0.30, y: 0.60 },
      { x: 0.50, y: 0.55 }, { x: 0.62, y: 0.40 }, { x: 0.40, y: 0.70 },
    ]

    const draw = () => {
      const W = canvas.width
      const H = canvas.height
      const cx = W * mousePos.x
      const cy = H * mousePos.y
      const R = Math.min(W, H) * 0.46

      // Smooth trail effect
      ctx.fillStyle = 'rgba(5, 10, 20, 0.15)'
      ctx.fillRect(0, 0, W, H)

      // Background circle
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(0,200,255,0.03)'
      ctx.fill()
      ctx.strokeStyle = 'rgba(0,200,255,0.12)'
      ctx.lineWidth = 1
      ctx.stroke()

      // Rings
      for (let i = 1; i <= 4; i++) {
        ctx.beginPath()
        ctx.arc(cx, cy, R * (i / 4), 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(0,200,255,${0.05 + i * 0.015})`
        ctx.lineWidth = 0.5
        ctx.stroke()
      }

      // Cross hairs
      ctx.strokeStyle = 'rgba(0,200,255,0.08)'
      ctx.lineWidth = 0.5
      ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke()

      // Grid lines
      for (let i = 1; i <= 6; i++) {
        const r = R * (i / 6)
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(0,200,255,${0.03 + i * 0.01})`
        ctx.lineWidth = 0.3
        ctx.stroke()
      }

      // Draw sweep as a filled arc sector
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(angle)
      const sweepGrad = ctx.createLinearGradient(0, 0, R, 0)
      sweepGrad.addColorStop(0, 'rgba(0,212,255,0.55)')
      sweepGrad.addColorStop(1, 'rgba(0,212,255,0)')
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.arc(0, 0, R, -0.4, 0)
      ctx.closePath()
      ctx.fillStyle = sweepGrad
      ctx.fill()
      // Sweep line
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(R, 0)
      ctx.strokeStyle = 'rgba(0,212,255,0.9)'
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.restore()

      // Ship dots
      dots.forEach((dot, i) => {
        const dx = (dot.x - 0.5) * 2 * R + cx
        const dy = (dot.y - 0.5) * 2 * R + cy
        const dist = Math.hypot(dx - cx, dy - cy)
        if (dist > R * 1.1) return

        const dotAngle = Math.atan2(dy - cy, dx - cx)
        let diff = ((dotAngle - angle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2)
        if (diff > Math.PI) diff = Math.PI * 2 - diff
        const brightness = Math.max(0, 1 - diff / 2)

        ctx.beginPath()
        ctx.arc(dx, dy, 4, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(0,212,255,${0.25 + brightness * 0.75})`
        ctx.fill()

        if (brightness > 0.5) {
          ctx.beginPath()
          ctx.arc(dx, dy, 10, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(0,212,255,${(brightness - 0.5) * 0.8})`
          ctx.lineWidth = 1.2
          ctx.stroke()
        }
      })

      angle += 0.012
      animId = requestAnimationFrame(draw)
    }

    draw()
    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [mousePos])

  // Ticker for live count animation
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  // Mouse parallax for radar
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({
        x: 0.4 + (e.clientX / window.innerWidth) * 0.2,
        y: 0.4 + (e.clientY / window.innerHeight) * 0.2,
      })
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  return (
    <div className="landing noise scanlines">
      {/* Background gradient */}
      <div className="gradient-radial" style={{ position: 'fixed', inset: 0, pointerEvents: 'none' }} />

      {/* NAVBAR */}
      <nav className="landing__nav glass">
        <div className="landing__navBrand">
          <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
            <polygon points="14,2 26,8 26,20 14,26 2,20 2,8" stroke="currentColor" strokeWidth="1.5" fill="none" />
            <circle cx="14" cy="14" r="2.5" fill="currentColor" />
          </svg>
          <span>Fleet Command</span>
        </div>
        <div className="landing__navLinks">
          <Link href="/command" className="button button-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            Launch Command
          </Link>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="landing__hero">
        <div className="landing__heroContent">
          <div className="landing__heroEyebrow">
            <span className="landing__liveChip">
              <span className="landing__liveDot" />
              LIVE SIMULATION
            </span>
            <span className="landing__eyebrowText">STRAIT OF HORMUZ · HIGH-RISK RED ZONE</span>
          </div>

          <h1 className="landing__heroTitle">
            Maritime<br />
            <span className="gradient-text">Crisis Command</span>
          </h1>

          <p className="landing__heroSub">
            15 cargo vessels. Live 1Hz telemetry. AI-powered distress analysis.<br />
            Full command-and-captain coordination in a real geopolitical crisis scenario.
          </p>

          <div className="landing__heroCtas">
            <Link href="/command" className="button button-primary" style={{ padding: '14px 28px', fontSize: '14px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" fill="none"/>
              </svg>
              Open Command Center
            </Link>
            <Link href="/captain/MV-3" className="button button-secondary">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L6 20l6-4 6 4L12 2z"/>
              </svg>
              Captain View · MV-3
            </Link>
          </div>

          <div className="landing__heroStats">
            <div className="landing__heroStat">
              <span className="landing__heroStatNum">15</span>
              <span className="landing__heroStatLabel">Vessels</span>
            </div>
            <div className="landing__heroStatDivider" />
            <div className="landing__heroStat">
              <span className="landing__heroStatNum">1Hz</span>
              <span className="landing__heroStatLabel">Update Rate</span>
            </div>
            <div className="landing__heroStatDivider" />
            <div className="landing__heroStat">
              <span className="landing__heroStatNum">AI</span>
              <span className="landing__heroStatLabel">Distress Parse</span>
            </div>
            <div className="landing__heroStatDivider" />
            <div className="landing__heroStat">
              <span className="landing__heroStatNum">LIVE</span>
              <span className="landing__heroStatLabel">Weather API</span>
            </div>
          </div>
        </div>

        {/* RADAR */}
        <div className="landing__radar">
          <canvas ref={canvasRef} className="landing__radarCanvas" />
          <div className="landing__radarLabel">HORMUZ SECTOR · ACTIVE TRACKING</div>
          <div className="landing__radarTick">
            T+{String(tick).padStart(4, '0')}s
          </div>
        </div>
      </section>

      {/* FEATURES BENTO GRID */}
      <section className="landing__features">
        <div className="landing__featuresInner">
          <div className="landing__sectionLabel">CAPABILITIES</div>
          <h2 className="landing__sectionTitle">Built for the crisis room</h2>
          <div className="bentoGrid">
            {FEATURES.map((f, i) => (
              <div key={f.label} className="bentoCard" style={{ animationDelay: `${i * 80}ms` }}>
                <span className="bentoIcon">{f.icon}</span>
                <h3 className="bentoTitle">{f.label}</h3>
                <p className="bentoDesc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FLEET ROSTER */}
      <section className="landing__fleet">
        <div className="landing__featuresInner">
          <div className="landing__sectionLabel">FLEET ROSTER</div>
          <h2 className="landing__sectionTitle">Active vessels in theater</h2>
          <div className="landing__shipGrid">
            {SHIPS.map((ship) => (
              <Link key={ship.id} href={`/captain/${ship.id}`} className="shipCard">
                <div className="shipIcon">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L6 20L12 16L18 20L12 2Z" fill="currentColor" stroke="white" strokeWidth="1.5"/>
                  </svg>
                </div>
                <div className="shipInfo">
                  <span className="shipId">{ship.id}</span>
                  <span className="shipName">{ship.name}</span>
                  <span className="shipCargo">{ship.cargo}</span>
                </div>
                <div className="shipStatus">
                  <span className="shipStatusDot" />
                  ACTIVE
                </div>
              </Link>
            ))}
            <div className="shipCardMore">
              <span>+10 more vessels</span>
              <Link href="/command">View all in Command →</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ROLES */}
      <section className="landing__roles">
        <div className="landing__featuresInner">
          <div className="landing__sectionLabel">ACCESS</div>
          <h2 className="landing__sectionTitle">Choose your station</h2>
          <div className="landing__rolesGrid">
            {ROLES.map((role) => (
              <div key={role.title} className={`landing__roleCard landing__roleCard--${role.variant}`}>
                <div className="landing__roleHeader">
                  <span className="landing__roleIcon">
                    {role.variant === 'command' ? '🎯' : '⚓'}
                  </span>
                  <span className={`landing__roleBadge ${role.variant === 'captain' ? 'landing__roleBadge--captain' : ''}`}>
                    {role.badge}
                  </span>
                </div>
                <h3>{role.title}</h3>
                <p>{role.desc}</p>
                <ul className="landing__roleFeatures">
                  {role.features.map((feat) => (
                    <li key={feat}>✓ {feat}</li>
                  ))}
                </ul>
                {role.variant === 'captain' ? (
                  <div className="landing__captainLinks">
                    {['MV-1','MV-2','MV-3','MV-4','MV-5'].map(id => (
                      <Link key={id} href={`/captain/${id}`} className="button button-secondary" style={{flex:1, justifyContent:'center', fontSize:'11px', height:'32px'}}>
                        {id}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <Link href={role.href} className="button button-primary" style={{marginTop: 'auto', padding: '12px 24px'}}>
                    {role.cta}
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="landing__footer">
        <div className="landing__footerInner">
          <div className="landing__footerBrand">
            <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
              <polygon points="14,2 26,8 26,20 14,26 2,20 2,8" stroke="currentColor" strokeWidth="1.5" fill="none" />
              <circle cx="14" cy="14" r="2.5" fill="currentColor" />
            </svg>
            <span>Fleet Command</span>
          </div>
          <p className="landing__footerSub">Real-time maritime crisis operations · Strait of Hormuz scenario · AI Hackathon</p>
        </div>
      </footer>
    </div>
  )
}
