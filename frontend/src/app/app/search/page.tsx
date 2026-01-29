import IntelligentSearch from '@/components/IntelligentSearch';

export const metadata = {
  title: 'AI Search | Learning Platform',
  description: 'Ask questions about your course materials',
};

export default function SearchPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <IntelligentSearch />
    </div>
  );
}
