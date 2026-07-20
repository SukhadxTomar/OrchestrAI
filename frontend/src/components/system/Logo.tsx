import { motion } from "framer-motion";
import { Link } from "react-router-dom";

/** The OrchestrAI mark: three orbiting nodes converging on a core. */
export function Logo({ size = 26, withWordmark = true }: { size?: number; withWordmark?: boolean }) {
  return (
    <Link to="/" className="group inline-flex items-center gap-2.5">
      <motion.svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        whileHover={{ rotate: 90 }}
        transition={{ type: "spring", stiffness: 200, damping: 18 }}
      >
        <defs>
          <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#9d8fff" />
            <stop offset="100%" stopColor="#4cc9f0" />
          </linearGradient>
        </defs>
        <circle cx="16" cy="16" r="4.5" fill="url(#logo-g)" />
        <circle cx="16" cy="4.5" r="2.6" fill="#9d8fff" opacity="0.9" />
        <circle cx="6" cy="23" r="2.6" fill="#7c6bff" opacity="0.75" />
        <circle cx="26" cy="23" r="2.6" fill="#4cc9f0" opacity="0.75" />
        <g stroke="url(#logo-g)" strokeWidth="1.3" opacity="0.5">
          <line x1="16" y1="7.5" x2="16" y2="11.5" />
          <line x1="8" y1="21.4" x2="12.4" y2="18.6" />
          <line x1="24" y1="21.4" x2="19.6" y2="18.6" />
        </g>
      </motion.svg>
      {withWordmark && (
        <span className="text-[15px] font-semibold tracking-tight text-fg">
          Orchestr<span className="text-accent-bright">AI</span>
        </span>
      )}
    </Link>
  );
}
