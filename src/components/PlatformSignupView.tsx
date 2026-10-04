import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowDown, Check, ChevronDown, LayoutTemplate, PackageCheck, Truck, ChartNoAxesCombined, Layers, Wallet, Sparkles, Store } from "lucide-react";
import { accentTextColor, type PlatformSignupContent } from "@/lib/platformSignupContent";
import StoreSignupForm from "./StoreSignupForm";
import "@/styles/platform-signup.css";

const featureIcons = [LayoutTemplate, PackageCheck, Truck, ChartNoAxesCombined, Layers, Wallet];

export default function PlatformSignupView({ content: c, preview = false }: { content: PlatformSignupContent; preview?: boolean }) {
  const prefix = preview ? "signup-preview" : "signup";
  const onAccent = accentTextColor(c.accentColor);
  const style = { "--ps-accent": c.accentColor, "--ps-on-accent": onAccent, "--ps-accent-ink": onAccent === "#FFFFFF" ? c.accentColor : "#142239" } as CSSProperties;
  return <div className={`ps-page${preview ? " ps-preview" : ""}`} dir="rtl" style={style}
    onClickCapture={preview ? e => { if ((e.target as HTMLElement).closest("a")) e.preventDefault(); } : undefined}>
    <a className="ps-skip" href={`#${prefix}-form`}>انتقل لنموذج التسجيل</a>
    <header className="ps-header"><div className="ps-shell ps-nav">
      <Link className="ps-brand" to="/" aria-label={`${c.brandName} — الرئيسية`}><img src="/logo.jpg" alt="" width="48" height="48" /><span>{c.brandName}<small>مساحة أعمالك الرقمية</small></span></Link>
      <nav aria-label="روابط صفحة التسجيل"><a className="ps-nav-features" href={`#${prefix}-features`}>ماذا تقدّم لك وصلة؟</a><Link to="/login" className="ps-login-link">تسجيل الدخول <ArrowLeft size={16} /></Link></nav>
    </div></header>
    <main>
      <section className="ps-hero ps-shell">
        <div className="ps-hero-copy">
          <span className="ps-eyebrow"><span />{c.badge}</span>
          <h1>{c.title}<em>{c.highlight}</em></h1>
          <p className="ps-lead">{c.description}</p>
          <div className="ps-hero-actions"><a href={`#${prefix}-form`} className="ps-button">{c.ctaText}<ArrowLeft size={19} /></a><a href={`#${prefix}-features`} className="ps-text-link">اكتشف وصلة <ArrowDown size={16} /></a></div>
          <div className="ps-benefits"><span><Check size={16} />واجهة عربية</span><span><Check size={16} />إدارة من الهاتف</span><span><Check size={16} />فيديوهات تعليمية</span></div>
          <div className="ps-workflow" aria-label="رحلة الطلب في وصلة">
            <div className="ps-workflow-head"><span><span className="ps-mini-mark"><Store size={17} /></span>رحلة طلبك في وصلة</span><span className="ps-live-dot">خطوات مترابطة</span></div>
            <div className="ps-workflow-steps">{[{icon:LayoutTemplate,label:"صفحة منتج"},{icon:PackageCheck,label:"طلب مؤكّد"},{icon:Truck,label:"شحن وتوصيل"},{icon:Wallet,label:"تحصيل وتسوية"}].map((step,i)=><div key={step.label}><span className="ps-workflow-icon"><step.icon size={22} /></span><b>{step.label}</b><small>0{i+1}</small></div>)}</div>
            <p><Sparkles size={15} />من أول نقرة إلى التحصيل، التفاصيل قدّامك.</p>
          </div>
        </div>
        <div id={`${prefix}-form`} className="ps-signup-card">
          <div className="ps-card-top"><span className="ps-card-icon"><Store size={25} /></span><span>بدايتك مع {c.brandName}</span></div>
          <h2>{c.formTitle}</h2><p className="ps-card-description">{c.formDescription}</p>
          <StoreSignupForm ctaText={c.ctaText} preview={preview} />
        </div>
      </section>
      <section id={`${prefix}-features`} className="ps-features-section"><div className="ps-shell">
        <div className="ps-section-intro"><span className="ps-kicker">أدوات تشتغل معاك</span><h2>{c.featuresTitle}</h2><span className="ps-section-caption">متجرك. طلباتك. أرقامك.<br />صورة واحدة أوضح.</span></div>
        <div className="ps-feature-grid">{c.features.map((feature,i)=>{const Icon=featureIcons[i % featureIcons.length];return <article className="ps-feature" key={i}><div className="ps-feature-top"><Icon size={25} /><span>0{i+1}</span></div><h3>{feature.title}</h3><p>{feature.description}</p></article>;})}</div>
      </div></section>
      <section className="ps-shell ps-steps-section"><div className="ps-section-intro"><span className="ps-kicker">طريقك للانطلاق</span><h2>{c.stepsTitle}</h2></div>
        <div className="ps-step-grid">{c.steps.map((step,i)=><article className="ps-step" key={i}><span>0{i+1}</span><h3>{step.title}</h3><p>{step.description}</p></article>)}</div>
      </section>
      {c.faqs.length > 0 && <section className="ps-faq-section"><div className="ps-shell ps-faq-grid"><div><span className="ps-kicker">أسئلة شائعة</span><h2>{c.faqTitle}</h2><p>بداية مرتّبة، وخطوات مفهومة.</p></div><div className="ps-faq-list">{c.faqs.map((faq,i)=><details key={i}><summary>{faq.question}<ChevronDown size={19} /></summary><p>{faq.answer}</p></details>)}</div></div></section>}
      <section className="ps-shell ps-closing"><div><span className="ps-kicker">خطوتك الجاية تبدأ هنا</span><h2>{c.closingTitle}</h2><p>{c.closingDescription}</p></div><a href={`#${prefix}-form`} className="ps-button">{c.ctaText}<ArrowLeft size={19} /></a></section>
    </main>
    <footer className="ps-footer"><div className="ps-shell"><span>© {new Date().getFullYear()} {c.brandName}</span><span>منصة عربية لإدارة التجارة</span><Link to="/privacy">سياسة الخصوصية</Link></div></footer>
  </div>;
}
