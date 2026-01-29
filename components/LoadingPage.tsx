import Image from 'next/image'

export default function LoadingPage() {
  return (
    <div className="bg-gradient-primary min-h-screen flex flex-col items-center justify-center px-4 py-8">
      <div className="relative mb-8 animate-pulse">
        <Image 
          src="/logo.png" 
          alt="SwipyEat Logo" 
          width={128} 
          height={128}
          priority
          className="drop-shadow-2xl"
        />
      </div>
    </div>
  )
}