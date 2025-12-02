import { DitheringShader } from '@/components/ui/dithering-shader';

export function HomePage() {
  return (
    <div className="relative flex h-screen w-full flex-col items-center justify-center overflow-hidden">
      <DitheringShader 
        shape="wave"
        type="8x8"
        colorBack="#001122"
        colorFront="#ff0088"
        pxSize={3}
        speed={0.6}
        className="fixed inset-0 -z-10"
        style={{ width: '100vw', height: '100vh' }}
      />
      
      {/* Fixed Header Logo */}
      <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-4 sm:pt-6 md:pt-8">
        <img 
          src="/sona-weblogo.svg" 
          alt="SONA Logo" 
          className="h-16 sm:h-20 md:h-24 w-auto"
        />
      </div>
    </div>
  );
}

