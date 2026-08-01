import { Link } from 'react-router-dom';
import { Mail, Github, Twitter, Linkedin } from 'lucide-react';

// Public Contact page — provides at least one contact method (email + social links)
// and a lightweight contact form that opens the visitor's email client via mailto.
export default function Contact() {
  const handleSubmit = (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const name = String(data.get('name') || '').trim();
    const subject = String(data.get('subject') || '').trim();
    const message = String(data.get('message') || '').trim();
    const body = `${message}\n\n— ${name}`;
    window.location.href = `mailto:hello@cognos.ai?subject=${encodeURIComponent(
      subject || 'COGNOS inquiry'
    )}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="font-heading text-3xl font-bold mb-4">Contact</h1>
      <p className="text-muted-foreground leading-relaxed mb-8">
        Questions, feedback, or partnership ideas? Reach the COGNOS team through any of the
        channels below — we read everything.
      </p>

      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
            <Mail className="w-4 h-4 text-primary" />
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Email</div>
            <a href="mailto:hello@cognos.ai" className="font-medium hover:text-primary transition-colors">hello@cognos.ai</a>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <a href="https://github.com/cognos" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <Github className="w-4 h-4" /> GitHub
          </a>
          <a href="https://twitter.com/cognos" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <Twitter className="w-4 h-4" /> Twitter
          </a>
          <a href="https://linkedin.com/company/cognos" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <Linkedin className="w-4 h-4" /> LinkedIn
          </a>
        </div>

        <form onSubmit={handleSubmit} className="border border-border rounded-xl p-4 space-y-3 bg-card">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="name" className="block text-xs text-muted-foreground mb-1">Name</label>
              <input id="name" name="name" type="text" className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary/50" placeholder="Your name" />
            </div>
            <div>
              <label htmlFor="subject" className="block text-xs text-muted-foreground mb-1">Subject</label>
              <input id="subject" name="subject" type="text" className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary/50" placeholder="What's this about?" />
            </div>
          </div>
          <div>
            <label htmlFor="message" className="block text-xs text-muted-foreground mb-1">Message</label>
            <textarea id="message" name="message" rows={4} className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary/50 resize-none" placeholder="How can we help?" />
          </div>
          <button type="submit" className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
            Send via email
          </button>
        </form>
      </div>

      <div className="mt-8 text-sm">
        <Link to="/about" className="text-muted-foreground hover:text-foreground transition-colors">← Back to About</Link>
      </div>
    </div>
  );
}