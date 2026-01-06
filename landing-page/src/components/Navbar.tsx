import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import DashboardPreview from "./DashboardPreview";

const navItems = [
  { label: "Beranda", href: "#beranda" },
  { label: "Fitur", href: "#fitur" },
  { label: "Integrasi POS", href: "#integrasi" },
];

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <nav className="glass-strong mx-4 mt-4 rounded-2xl px-6 py-3 shadow-lg overflow-visible">
        <div className="container mx-auto flex items-center justify-between h-10">
          {/* Logo */}
          <a href="#beranda" className="flex items-center relative">
            <img src="/logo-siprems.png" alt="Siprems Logo" className="h-16 w-16 rounded-xl object-contain" style={{ marginTop: '-8px', marginBottom: '-8px' }} />
            <span className="text-xl font-bold text-foreground">Siprems</span>
          </a>

          {/* Desktop Navigation */}
          <div className="hidden items-center gap-8 md:flex">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </a>
            ))}
            
            {/* Prediksi Cerdas with Mega Menu */}
            <div
              className="relative"
              onMouseEnter={() => setShowPreview(true)}
              onMouseLeave={() => setShowPreview(false)}
            >
              <button className="flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary/80">
                Prediksi Cerdas
                <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${showPreview ? "rotate-180" : ""}`} />
              </button>
              
              <AnimatePresence>
                {showPreview && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="absolute right-0 top-full mt-4 w-[700px]"
                  >
                    <div className="glass-strong rounded-2xl p-6 shadow-xl">
                      <p className="mb-4 text-sm font-semibold text-foreground">Preview Dashboard Prediksi</p>
                      <DashboardPreview compact />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Auth Buttons */}
          <div className="hidden items-center gap-3 md:flex">
            <Button variant="ghost" size="sm" asChild>
              <a href={`${import.meta.env.VITE_APP_URL}/login`}>Login</a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={`${import.meta.env.VITE_APP_URL}/register`}>Register</a>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle menu"
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 md:hidden"
            >
              <div className="flex flex-col gap-4 border-t border-border/50 pt-4">
                {navItems.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    className="text-sm font-medium text-muted-foreground"
                    onClick={() => setIsOpen(false)}
                  >
                    {item.label}
                  </a>
                ))}
                <a
                  href="#prediksi"
                  className="text-sm font-medium text-primary"
                  onClick={() => setIsOpen(false)}
                >
                  Prediksi Cerdas
                </a>
                <div className="flex gap-2 pt-2">
                  <Button variant="ghost" size="sm" className="flex-1" asChild>
                    <a href={`${import.meta.env.VITE_APP_URL}/login`}>Login</a>
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1" asChild>
                    <a href={`${import.meta.env.VITE_APP_URL}/register`}>Register</a>
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </header>
  );
};

export default Navbar;
