export default function LoadingSpinner({ message = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="relative w-14 h-14">
        <div className="absolute inset-0 rounded-full border-4 border-orange-100" />
        <div className="absolute inset-0 rounded-full border-4 border-orange-500 border-t-transparent animate-spin" />
        <span className="absolute inset-0 flex items-center justify-center text-xl">🍽️</span>
      </div>
      <p className="text-gray-500 text-sm animate-pulse">{message}</p>
    </div>
  );
}
