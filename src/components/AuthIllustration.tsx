import illustration from '../assets/business-analytics.png';

export function AuthIllustration() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <img
        src={illustration}
        alt="Business Analytics Illustration"
        className="w-full h-full max-w-[80%] max-h-[80%] object-contain"
      />
    </div>
  );
}
