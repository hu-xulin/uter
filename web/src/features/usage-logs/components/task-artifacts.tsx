/*
Copyright (C) 2023-2026 Uter.ai

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@uter.ai
*/
import { useQuery } from '@tanstack/react-query'
import {
  CircleAlert,
  Download,
  File,
  Image,
  Music,
  RefreshCw,
  Video,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { requireServerSuccess } from '@/lib/server-error-message'
import { cn } from '@/lib/utils'

import { getTaskArtifacts } from '../api'
import {
  resolveTaskPreviewMode,
  shouldLoadTaskArtifacts,
} from '../lib/task-artifacts'
import type { TaskArtifact, TaskArtifactType, TaskLog } from '../types'
import { AudioPreviewDialog } from './dialogs/audio-preview-dialog'

function artifactIcon(type: TaskArtifactType) {
  switch (type) {
    case 'image':
      return Image
    case 'video':
      return Video
    case 'audio':
      return Music
    case 'file':
      return File
  }
}

function artifactTypeLabel(type: TaskArtifactType): string {
  switch (type) {
    case 'image':
      return 'Image'
    case 'video':
      return 'Video'
    case 'audio':
      return 'Audio'
    case 'file':
      return 'File'
  }
}

// Task lists no longer carry the persisted snapshot, so the legacy Suno clip
// list is fetched through the artifacts endpoint when the preview opens.
function LegacyAudioPreview(props: { taskId: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const artifactsQuery = useQuery({
    queryKey: ['usage-logs', 'task-artifacts', props.taskId],
    queryFn: async () =>
      requireServerSuccess(await getTaskArtifacts(props.taskId)),
    enabled: open,
    retry: false,
    staleTime: 30_000,
  })

  return (
    <>
      <button
        type='button'
        className='group flex items-center gap-1 text-left text-sm'
        onClick={() => setOpen(true)}
      >
        <Music className='text-muted-foreground size-4' aria-hidden='true' />
        <span className='text-foreground group-hover:'>
          {' '}
          {t('Click to preview audio')}
        </span>
      </button>
      <AudioPreviewDialog
        open={open}
        onOpenChange={setOpen}
        clips={artifactsQuery.data?.legacyAudioClips ?? []}
        loading={open && artifactsQuery.isPending}
      />
    </>
  )
}

function ArtifactMedia(props: {
  artifact: TaskArtifact
  mediaUrl: string
  onError: () => void
}) {
  if (props.artifact.type === 'image') {
    return (
      <img
        src={props.mediaUrl}
        alt={props.artifact.key}
        loading='lazy'
        className='max-h-[60vh] w-full rounded-md object-contain'
        onError={props.onError}
      />
    )
  }
  if (props.artifact.type === 'video') {
    return (
      <video
        src={props.mediaUrl}
        controls
        preload='metadata'
        className='max-h-[60vh] w-full rounded-md bg-black'
        onError={props.onError}
      />
    )
  }
  if (props.artifact.type === 'audio') {
    return (
      <audio
        src={props.mediaUrl}
        controls
        preload='none'
        className='w-full'
        onError={props.onError}
      />
    )
  }
  return null
}

function MediaFailure(props: { onRetry: () => void }) {
  const { t } = useTranslation()
  return (
    <Alert variant='destructive'>
      <CircleAlert aria-hidden='true' />
      <AlertTitle>{t('Media preview failed. Please try again.')}</AlertTitle>
      <AlertDescription>{t('Preview unavailable')}</AlertDescription>
      <AlertAction>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={props.onRetry}
        >
          <RefreshCw data-icon='inline-start' />
          {t('Retry')}
        </Button>
      </AlertAction>
    </Alert>
  )
}

function TaskArtifactCard(props: { artifact: TaskArtifact }) {
  const { t } = useTranslation()
  const [mediaFailed, setMediaFailed] = useState(false)
  const [mediaRevision, setMediaRevision] = useState(0)
  const ArtifactIcon = artifactIcon(props.artifact.type)
  const isVisualArtifact =
    props.artifact.type === 'image' || props.artifact.type === 'video'

  let cardContent = (
    <div
      className={cn(
        'bg-muted/40 text-muted-foreground flex items-center justify-center rounded-md',
        isVisualArtifact ? 'aspect-video min-h-48' : 'min-h-20'
      )}
    >
      <ArtifactIcon className='size-8' />
    </div>
  )
  if (mediaFailed) {
    cardContent = (
      <MediaFailure
        onRetry={() => {
          setMediaFailed(false)
          setMediaRevision((revision) => revision + 1)
        }}
      />
    )
  } else if (props.artifact.type !== 'file') {
    cardContent = (
      <ArtifactMedia
        key={mediaRevision}
        artifact={props.artifact}
        mediaUrl={props.artifact.content_url}
        onError={() => setMediaFailed(true)}
      />
    )
  }

  return (
    <Card size='sm'>
      <CardHeader>
        <CardTitle className='flex min-w-0 items-center gap-1.5'>
          <ArtifactIcon className='size-4 shrink-0' aria-hidden='true' />
          <span className='truncate'>
            {t(artifactTypeLabel(props.artifact.type))}
          </span>
        </CardTitle>
        <CardDescription className='min-w-0'>
          <span className='text-mono block truncate font-mono'>
            {props.artifact.key}
          </span>
          {props.artifact.mime_type ? (
            <span className='text-mono block truncate font-mono'>
              {props.artifact.mime_type}
            </span>
          ) : null}
        </CardDescription>
      </CardHeader>
      <CardContent>{cardContent}</CardContent>
      <CardFooter>
        <Button
          variant='outline'
          size='sm'
          nativeButton={false}
          render={
            <a
              href={props.artifact.content_url}
              download={props.artifact.key}
              target='_blank'
              rel='noopener noreferrer'
            />
          }
        >
          <Download data-icon='inline-start' />
          {t('Download')}
        </Button>
      </CardFooter>
    </Card>
  )
}

interface TaskArtifactsProps {
  taskId: string
  enabled: boolean
  emptyContent?: (legacyContentUrl?: string) => React.ReactNode
}

function TaskArtifacts(props: TaskArtifactsProps) {
  const { t } = useTranslation()
  const artifactsQuery = useQuery({
    queryKey: ['usage-logs', 'task-artifacts', props.taskId],
    queryFn: async () =>
      requireServerSuccess(await getTaskArtifacts(props.taskId)),
    enabled: props.enabled,
    retry: false,
    staleTime: 30_000,
  })

  if (!props.enabled) return null

  if (artifactsQuery.isPending) {
    return (
      <div aria-label={t('Loading...')}>
        <Skeleton className='aspect-video min-h-48 w-full rounded-xl' />
      </div>
    )
  }

  if (artifactsQuery.isError) {
    return (
      <Alert variant='destructive'>
        <CircleAlert aria-hidden='true' />
        <AlertTitle>{t('Failed to load artifacts')}</AlertTitle>
        <AlertDescription>{t('Preview unavailable')}</AlertDescription>
        <AlertAction>
          <Button
            type='button'
            variant='outline'
            size='sm'
            disabled={artifactsQuery.isFetching}
            onClick={() => void artifactsQuery.refetch()}
          >
            {artifactsQuery.isFetching ? (
              <Spinner data-icon='inline-start' />
            ) : (
              <RefreshCw data-icon='inline-start' />
            )}
            {t('Retry')}
          </Button>
        </AlertAction>
      </Alert>
    )
  }

  if (artifactsQuery.data.artifacts.length === 0) {
    return (
      props.emptyContent?.(artifactsQuery.data.legacyContentUrl) ?? (
        <EmptyTaskArtifacts />
      )
    )
  }

  return (
    <div
      className={cn(
        'grid gap-3',
        artifactsQuery.data.artifacts.length > 1 && 'lg:grid-cols-2'
      )}
    >
      {artifactsQuery.data.artifacts.map((artifact) => (
        <TaskArtifactCard key={artifact.key} artifact={artifact} />
      ))}
    </div>
  )
}

function EmptyTaskArtifacts() {
  const { t } = useTranslation()
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant='icon'>
          <File aria-hidden='true' />
        </EmptyMedia>
        <EmptyTitle>{t('Artifacts')}</EmptyTitle>
        <EmptyDescription>{t('None')}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

function LegacyTaskArtifacts(props: { legacyContentUrl?: string }) {
  if (props.legacyContentUrl) {
    return <LegacyVideoMedia contentUrl={props.legacyContentUrl} />
  }
  return <EmptyTaskArtifacts />
}

export function TaskArtifactsCell(props: { log: TaskLog }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const previewMode = resolveTaskPreviewMode(props.log)

  if (previewMode === 'discarded') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={
              <span className='text-muted-foreground cursor-help text-xs' />
            }
          >
            {t('Result not retained')}
          </TooltipTrigger>
          <TooltipContent>
            {t(
              'The result was returned in the API response and was not saved as an artifact'
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }
  if (!shouldLoadTaskArtifacts(props.log, true)) {
    return <span className='text-muted-foreground text-xs'>-</span>
  }
  if (previewMode === 'legacy-suno') {
    return <LegacyAudioPreview taskId={props.log.task_id} />
  }

  return (
    <>
      {previewMode === 'legacy-video' ? (
        <Button
          type='button'
          variant='link'
          size='inline'
          className='text-foreground'
          onClick={() => setOpen(true)}
        >
          {t('Click to preview video')}
        </Button>
      ) : (
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={() => setOpen(true)}
        >
          <File data-icon='inline-start' />
          {t('Artifacts')}
        </Button>
      )}
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={
          previewMode === 'legacy-video' ? (
            t('Preview')
          ) : (
            <span className='flex items-center gap-2'>
              <File
                className='text-muted-foreground size-4'
                aria-hidden='true'
              />
              {t('Artifacts')}
            </span>
          )
        }
        contentClassName={
          previewMode === 'legacy-video' ? 'sm:max-w-xl' : 'sm:max-w-4xl'
        }
        contentHeight='auto'
        bodyClassName='pr-2 sm:pr-4'
      >
        <TaskArtifacts
          taskId={props.log.task_id}
          enabled={shouldLoadTaskArtifacts(props.log, open)}
          emptyContent={(legacyContentUrl) => (
            <LegacyTaskArtifacts legacyContentUrl={legacyContentUrl} />
          )}
        />
      </Dialog>
    </>
  )
}

interface LegacyVideoMediaProps {
  contentUrl: string
}

function LegacyVideoMedia(props: LegacyVideoMediaProps) {
  const [mediaFailed, setMediaFailed] = useState(false)
  const [mediaRevision, setMediaRevision] = useState(0)

  return mediaFailed ? (
    <MediaFailure
      onRetry={() => {
        setMediaFailed(false)
        setMediaRevision((revision) => revision + 1)
      }}
    />
  ) : (
    <video
      key={mediaRevision}
      src={props.contentUrl}
      controls
      preload='metadata'
      className='max-h-[60vh] w-full rounded-md bg-black'
      onError={() => setMediaFailed(true)}
    />
  )
}
