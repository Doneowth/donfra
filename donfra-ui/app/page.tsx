'use client';
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import SignInModal from "@/components/auth/SignInModal";
import SignUpModal from "@/components/auth/SignUpModal";


export default function Home() {
  useEffect(() => { document.body.style.margin = "0"; }, []);

  const router = useRouter();
  const { user, logout } = useAuth();
  const [showSignIn, setShowSignIn] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleSwitchToSignUp = () => {
    setShowSignIn(false);
    setShowSignUp(true);
  };

  const handleSwitchToSignIn = () => {
    setShowSignUp(false);
    setShowSignIn(true);
  };

  const handleLogout = async () => {
    await logout();
    setShowUserMenu(false);
  };

  return (
    <main className="app-root">
      {/* ===== HEADER ===== */}
      <header className="header">
        <div className="container header-inner">
          <div className="logo">
            <img src="/donfra.png" alt="Donfra" style={{ height: 70, width: "auto", border: "none", outline: "none" }} />
          </div>
          <nav className="nav">
            <a href="#top">Home</a>
            <a href="/library">Library</a>
            <a href="#pipeline">Mission Path</a>
            <a href="#stories">Stories</a>
            <a href="#contact">Contact</a>
            <a href="/live">Live</a>

            {user ? (
              <div className="user-menu">
                <span className="user-welcome">Welcome,</span>
                <button className="user-button" onClick={() => setShowUserMenu(!showUserMenu)}>
                  {user.username || user.email}
                </button>
                {showUserMenu && (
                  <div className="user-dropdown">
                    <div className="user-info">
                      <p className="user-email">{user.email}</p>
                      <p className="user-role">{user.role}</p>
                    </div>
                    <button className="dropdown-item" onClick={() => { router.push("/user"); setShowUserMenu(false); }}>
                      Profile
                    </button>
                    <button className="dropdown-item" onClick={handleLogout}>
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <button className="nav-auth-btn" onClick={() => setShowSignIn(true)}>
                  Sign In
                </button>
                <button className="nav-auth-btn nav-auth-btn-primary" onClick={() => setShowSignUp(true)}>
                  Sign Up
                </button>
              </>
            )}
          </nav>
        </div>
      </header>

      <SignInModal
        isOpen={showSignIn}
        onClose={() => setShowSignIn(false)}
        onSwitchToSignUp={handleSwitchToSignUp}
      />
      <SignUpModal
        isOpen={showSignUp}
        onClose={() => setShowSignUp(false)}
        onSwitchToSignIn={handleSwitchToSignIn}
      />

      {/* ===== HERO ===== */}
      <section id="top" className="hero">
      <video
        className="hero-video"
        autoPlay
        loop
        muted
        playsInline
      >
        <source src="DB12.mp4" type="video/mp4" />
      </video>
        <div className="hero-overlay-grid" />
        <div className="hero-vignette" />

        <div className="container hero-inner">
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9 }}
            className="display"
          >
            Precision. Preparation. Placement.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.2 }}
            className="lead"
          >
            I help you land your first internship or job — from résumé to offer, with precision.
          </motion.p>
        </div>
      </section>

      {/* PIPELINE */}
      <section id="pipeline" className="section panel">
        <div className="container">
          <h2 className="display h2">Your Mission Path</h2>
          <div className="grid grid-4">
            {[
              { title: "Profiling", sub: "Find your signal", desc: "Surface strengths, goals, and target-company fit." },
              { title: "Résumé Upgrades", sub: "Polish & projects", desc: "ATS-ready bullets, quantified impact, project customization." },
              { title: "Interview Instrumenting", sub: "LeetCode · OOD · Systems", desc: "Deliberate drills, clarity under pressure, edge cases & tradeoffs." },
              { title: "Advance Advising", sub: "Cloud · AI · PaaS", desc: "Market intel, role targeting, and runway for the next step." },
            ].map((s, i) => (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.6, delay: i * 0.12 }}
                className="card panel-deeper sheen-card"
              >
                <h3 className="display h3 brass flex-row">
                  <span>{s.title}</span>
                  <span className="chip">V1</span>
                </h3>
                <p className="muted small">{s.sub}</p>
                <p className="body">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* STORIES */}
      <section id="stories" className="section panel">
        <div className="container">
          <h2 className="display h2">Success Stories</h2>
          <div className="grid grid-3">
            {[
              { name: "SWE Intern @ NYC FinTech", note: "Two-week sprint: quantified résumé + mock drills", tag: "Intern" },
              { name: "Full-time @ Cloud Startup", note: "Custom project + system design narrative", tag: "New Grad" },
              { name: "Data Eng @ BigCo", note: "SQL + LeetCode cadence, consistent progress", tag: "Offer" }
            ].map((c, i) => (
              <div key={i} className="card panel-deeper">
                <div className="flex-row" style={{ marginBottom: 8 }}>
                  <span className="semibold">{c.name}</span>
                  <span className="chip chip--ghost">{c.tag}</span>
                </div>
                <p className="muted small">{c.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="section hero-alt">
      <div className="container center">
        <p className="lead muted">
          Your first job is your mission. Add me to start your training.
        </p>
        <div className="contact-row">
          <div className="contact-card">
            <div className="qr-box">
              <img src="/dc-qr.jpg" alt="Discord QR" />
            </div>
            <p className="small">Discord</p>
          </div>
          <div className="contact-card">
            <div className="qr-box">
              <img src="/wechat-qr.jpg" alt="WeChat QR" />
            </div>
            <p className="small">WeChat</p>
          </div>
        </div>
      </div>
    </section>


    </main>
  );
}
