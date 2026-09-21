package relayconvert

import relaymedia "github.com/QuantumNous/uter/relaykit/relayconvert/internal/media"

type MediaResolver = relaymedia.MediaResolver

func SetMediaResolver(resolver MediaResolver) {
	relaymedia.SetMediaResolver(resolver)
}
