import { db } from "@/lib/db";
import { UploadDialog } from "@/components/library/upload-dialog";
import { DocumentList } from "@/components/library/document-list";

async function getDocuments() {
  return db.document.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      researchAreas: { include: { researchArea: true } },
      _count: { select: { chunks: true } },
    },
    take: 50,
  });
}

export default async function LibraryPage() {
  const documents = await getDocuments();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Library</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            {documents.length} documents in the knowledge base
          </p>
        </div>
        <UploadDialog />
      </div>

      <DocumentList documents={documents} />
    </div>
  );
}
