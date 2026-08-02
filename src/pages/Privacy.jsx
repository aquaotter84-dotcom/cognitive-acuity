import { Link } from 'react-router-dom';
import { Brain } from 'lucide-react';

// Public Privacy Policy page. Plain semantic HTML for search indexability.
// Covers the data COGNOS collects, why, how it's stored, user rights, and
// contact path. Authenticated in-app data flows (messages, memories, beliefs,
// documents) are governed by per-entity row-level security described here.
export default function Privacy() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
          <Brain className="w-5 h-5 text-white" />
        </div>
        <span className="font-heading text-xl font-semibold tracking-tight">COGNOS</span>
      </div>

      <h1 className="font-heading text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground mb-8">Last updated: August 2, 2026</p>

      <div className="space-y-6 text-muted-foreground leading-relaxed">
        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground mb-2">Overview</h2>
          <p>
            COGNOS — Cognitive Operators for Guidance, Navigation, Oversight, and Sovereignty —
            is a multi-agent reasoning workspace. This policy explains what information we collect,
            why we collect it, how it is protected, and the controls you have over it. We design
            COGNOS around a single principle: your data serves your thinking. It is never sold, and
            it is never used to train external models.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground mb-2">Information We Collect</h2>
          <ul className="list-disc pl-5 space-y-1.5">
            <li><span className="font-medium text-foreground">Account information</span> — your email address and name, used for authentication and to address you in the interface.</li>
            <li><span className="font-medium text-foreground">Workspace content</span> — the conversations, messages, memories, documents, insights, and beliefs you create. This is the substance of your reasoning sessions.</li>
            <li><span className="font-medium text-foreground">Uploaded files</span> — documents and media you attach for analysis. These are stored to serve you and are accessible only within the workspace you place them in.</li>
            <li><span className="font-medium text-foreground">Usage metadata</span> — audit events such as model used, task type, latency, and status. These help us monitor reliability and cost, not profile you.</li>
            <li><span className="font-medium text-foreground">Technical data</span> — standard request information (IP, browser, device) collected automatically when you use the service.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground mb-2">How We Use Your Information</h2>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>To operate your reasoning sessions — assembling context, running the cognitive council, and returning responses.</li>
            <li>To maintain your memory across sessions so COGNOS stays aligned with your long-term goals.</li>
            <li>To generate optional autonomous insights and belief derivations within your workspace.</li>
            <li>To secure and isolate your data from other users through row-level access controls.</li>
            <li>To diagnose errors, measure latency, and improve reliability.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground mb-2">Data Isolation & Security</h2>
          <p>
            Every core record — conversations, messages, memories, documents, insights, beliefs, and
            audit events — is bound to your account and workspace. Access is enforced at the record
            level: only you and the workspace members you explicitly invite can read or act on your
            data. Administrative access is restricted to platform operators for reliability and abuse
            prevention and is never used to browse your reasoning content.
          </p>
          <p>
            Data in transit is encrypted via TLS. Authentication tokens are managed by the platform's
            auth backend; we do not store raw passwords.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground mb-2">AI Processing</h2>
          <p>
            Your prompts and assembled context are sent to language-model providers to generate
            responses. COGNOS sends only what is needed to answer your request within the active
            workspace. We do not share your data with third parties for their own training purposes,
            and we do not use your content to train models on COGNOS's behalf.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground mb-2">Data Retention & Deletion</h2>
          <p>
            Your data is retained for as long as your account is active. You can delete individual
            conversations, memories, documents, and beliefs at any time from within the app. Deleting
            a conversation removes its messages. Account deletion permanently and irreversibly
            removes all workspaces, conversations, messages, memories, documents, insights, beliefs,
            and audit events you own — available in Settings.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground mb-2">Your Rights</h2>
          <ul className="list-disc pl-5 space-y-1.5">
            <li><span className="font-medium text-foreground">Access</span> — view everything stored in your workspaces at any time.</li>
            <li><span className="font-medium text-foreground">Correction</span> — edit memories, rename conversations, and update your profile.</li>
            <li><span className="font-medium text-foreground">Deletion</span> — remove individual records or your entire account.</li>
            <li><span className="font-medium text-foreground">Portability</span> — export your content through the tools available in the app.</li>
            <li><span className="font-medium text-foreground">Revocation</span> — disconnect shared memories and remove workspace members you invited.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground mb-2">Cookies & Local Storage</h2>
          <p>
            COGNOS uses local storage to keep you signed in and remember interface preferences such as
            communication style. We do not use advertising or cross-site tracking cookies.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground mb-2">Children's Privacy</h2>
          <p>
            COGNOS is not directed at children under 13, and we do not knowingly collect their
            information. If you believe a minor has registered, contact us so we can remove the
            account.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground mb-2">Changes to This Policy</h2>
          <p>
            We may update this policy as COGNOS evolves. Material changes will be reflected by an
            updated "Last updated" date above. Continued use after a change constitutes acceptance of
            the revised policy.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground mb-2">Contact</h2>
          <p>
            Questions about your data or this policy? Reach out through our <Link to="/contact" className="text-primary hover:text-primary/80 transition-colors">contact page</Link>.
            For account-specific requests, sign in and use the in-app deletion controls first — then
            contact us if you need further help.
          </p>
        </section>
      </div>

      <div className="mt-8 flex items-center gap-4 text-sm">
        <Link to="/about" className="text-primary hover:text-primary/80 transition-colors">About COGNOS →</Link>
        <Link to="/contact" className="text-muted-foreground hover:text-foreground transition-colors">Contact</Link>
        <Link to="/login" className="text-muted-foreground hover:text-foreground transition-colors">Sign in</Link>
      </div>
    </div>
  );
}