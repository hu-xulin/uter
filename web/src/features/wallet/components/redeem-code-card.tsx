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
import { Gift, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TitledCard } from '@/components/ui/titled-card'

interface RedeemCodeCardProps {
  code: string
  onCodeChange: (code: string) => void
  onRedeem: () => void
  redeeming: boolean
  enabled: boolean
  topupLink?: string
}

export function RedeemCodeCard(props: RedeemCodeCardProps) {
  const { t } = useTranslation()

  return (
    <TitledCard
      title={t('Redemption Code')}
      icon={<Gift className='h-4 w-4' />}
      iconTone='warning'
      disableHoverEffect
    >
      {props.enabled ? (
        <div className='space-y-3'>
          <Label htmlFor='redemption-code' className='text-muted-foreground'>
            {t('Have a Code?')}
          </Label>
          <div className='grid grid-cols-[minmax(0,1fr)_auto] gap-2'>
            <Input
              id='redemption-code'
              value={props.code}
              onChange={(event) => props.onCodeChange(event.target.value)}
              placeholder={t('Enter your redemption code')}
              className='min-w-0'
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !props.redeeming) {
                  props.onRedeem()
                }
              }}
            />
            <Button
              onClick={props.onRedeem}
              disabled={props.redeeming}
              className='h-(--ds-control-height-md) px-4'
            >
              {props.redeeming && (
                <Loader2 className='mr-2 h-4.5 w-4.5 animate-spin' />
              )}
              {t('Redeem')}
            </Button>
          </div>
          {props.topupLink && (
            <p className='text-muted-foreground text-sm'>
              {t('Need a redemption code?')}{' '}
              <a
                href={props.topupLink}
                target='_blank'
                rel='noopener noreferrer'
                className='inline-flex items-center gap-1'
              >
                {t('Get one here')}
              </a>
            </p>
          )}
        </div>
      ) : (
        <Alert>
          <AlertDescription>
            {t(
              'Redemption codes are disabled until the administrator confirms compliance terms.'
            )}
          </AlertDescription>
        </Alert>
      )}
    </TitledCard>
  )
}
