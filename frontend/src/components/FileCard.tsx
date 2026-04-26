'use client'

import FilePreview from './FilePreview'

export interface FileCardProps {
  readonly filename: string
  readonly path: string
  readonly description?: string
}

export default function FileCard({ filename, path, description }: FileCardProps) {
  return <FilePreview filename={filename} path={path} description={description} />
}
