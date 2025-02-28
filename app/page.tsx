import TelecomSimulator from "@/components/telecom-simulator"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-2 text-center">Telecom Infrastructure Resilience Simulator</h1>
      <p className="text-gray-600 mb-6 text-center max-w-3xl">
        Visualize and analyze network resilience in rural and disaster-prone areas of the Philippines
      </p>
      <TelecomSimulator />
    </main>
  )
}

