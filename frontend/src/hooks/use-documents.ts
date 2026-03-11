import { useQuery, useQueryClient } from "@tanstack/react-query";
import { mockDocuments, type DocumentRecord } from "@/lib/documents-data";

/**
 * Hook to fetch documents.
 * Currently returns mock data from TIM.
 * TODO: Replace with fetchDocuments() from @/lib/api once backend
 * has the enriched document fields (document_type, extraction_confidence, etc.)
 */
export function useDocuments() {
  const queryClient = useQueryClient();

  const { data: documents = [], isLoading, error } = useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      // TODO: fetch from API and map to DocumentRecord
      // const raw = await fetchDocuments();
      // return raw.map(mapToDocumentRecord);
      return mockDocuments;
    },
  });

  const refetch = () =>
    queryClient.invalidateQueries({ queryKey: ["documents"] });

  return { documents, isLoading, error, refetch };
}
