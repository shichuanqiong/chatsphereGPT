import ResponsiveAd, { type AdType } from './ResponsiveAd';

export default function TopAdPlaceholder({
  label = "Ad — Top Banner",
  sticky = false,
  type = 'placeholder' as AdType,
  slot = '',
  clientId = '',
}: { 
  label?: string; 
  sticky?: boolean;
  type?: AdType;
  slot?: string;
  clientId?: string;
}) {
  return (
    <div
      role="banner"
      aria-label="advertising-top"
      className={[
        "w-full flex justify-center",
        sticky ? "sticky top-2 z-40" : "mt-3",
      ].join(" ")}
    >
      {/* 预留固定高度，避免加载后版式抖动（CLS） */}
      <div className="w-full max-w-[728px]">
        <div className="h-[48px] md:h-[60px] rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-[0_6px_24px_rgba(0,0,0,.25)] flex items-center justify-center overflow-hidden">
          <ResponsiveAd 
            type={type}
            slot={slot}
            clientId={clientId}
            label={label}
          />
        </div>
      </div>
    </div>
  );
}
