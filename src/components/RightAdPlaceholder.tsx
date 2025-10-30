import ResponsiveAd, { type AdType } from './ResponsiveAd';

export default function RightAdPlaceholder({
  label = "Ad — Right Rail",
  type = 'placeholder' as AdType,
  slot = '',
  clientId = '',
}: {
  label?: string;
  type?: AdType;
  slot?: string;
  clientId?: string;
}) {
  return (
    <div
      role="complementary"
      aria-label="advertising-right"
      className="w-[320px] max-w-full rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-[0_6px_24px_rgba(0,0,0,.25)] overflow-hidden h-[250px] md:h-[300px] flex items-center justify-center"
    >
      <ResponsiveAd
        type={type}
        slot={slot}
        clientId={clientId}
        label={label}
      />
    </div>
  );
}
