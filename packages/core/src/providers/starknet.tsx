import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { createContext, useContext, useEffect, useReducer, useCallback } from 'react'
import { defaultProvider, ProviderInterface } from 'starknet'
import { Connector } from '~/connectors'
import { ConnectorNotFoundError } from '~/errors'

/** State of the StarkNet context. */
export interface StarknetState {
  /**
   * Connected account address.
   *
   * @deprecated Use `useAccount`.
   */
  account?: string
  /**
   * Connect the given connector.
   *
   * @deprecated Use `useConnectors`.
   */
  connect: (connector: Connector) => void
  /**
   * Disconnect the currently connected connector.
   *
   * @deprecated Use `useConnectors`.
   */
  disconnect: () => void
  /** List of registered connectors.
   *
   * @deprecated Use `useConnectors`.
   */
  connectors: Connector[]
  /** Current provider. */
  library: ProviderInterface
  /** Error. */
  error?: Error
}

const STARKNET_INITIAL_STATE: StarknetState = {
  account: undefined,
  connect: () => undefined,
  disconnect: () => undefined,
  library: defaultProvider,
  connectors: [],
}

const StarknetContext = createContext<StarknetState>(STARKNET_INITIAL_STATE)

/** Returns the current StarkNet context state. */
export function useStarknet(): StarknetState {
  return useContext(StarknetContext)
}

interface StarknetManagerState {
  account?: string
  connectors: Connector[]
  connector?: Connector
  library: ProviderInterface
  error?: Error
}

interface SetAccount {
  type: 'set_account'
  account?: string
}

interface SetProvider {
  type: 'set_provider'
  provider?: ProviderInterface
}

interface SetConnector {
  type: 'set_connector'
  connector?: Connector
}

interface SetError {
  type: 'set_error'
  error: Error
}

type Action = SetAccount | SetProvider | SetConnector | SetError

function reducer(state: StarknetManagerState, action: Action): StarknetManagerState {
  switch (action.type) {
    case 'set_account': {
      return { ...state, account: action.account }
    }
    case 'set_provider': {
      return { ...state, library: action.provider ?? defaultProvider }
    }
    case 'set_connector': {
      return { ...state, connector: action.connector }
    }
    case 'set_error': {
      return { ...state, error: action.error }
    }
    default: {
      return state
    }
  }
}

interface UseStarknetManagerProps {
  defaultProvider?: ProviderInterface
  connectors?: Connector[]
  autoConnect?: boolean
}

function useStarknetManager({
  defaultProvider: userDefaultProvider,
  connectors: userConnectors,
  autoConnect,
}: UseStarknetManagerProps): StarknetState {
  const connectors = userConnectors ?? []
  const [state, dispatch] = useReducer(reducer, {
    library: userDefaultProvider ? userDefaultProvider : defaultProvider,
    connectors,
  })

  const { account, library, error } = state

  const connect = useCallback((connector: Connector) => {
    connector.connect().then(
      (account) => {
        dispatch({ type: 'set_account', account: account.address })
        dispatch({ type: 'set_provider', provider: account })
        dispatch({ type: 'set_connector', connector })
      },
      (err) => {
        console.error(err)
        dispatch({ type: 'set_error', error: new ConnectorNotFoundError() })
      }
    )
  }, [])

  const disconnect = useCallback(() => {
    if (!state.connector) return
    state.connector.disconnect().then(
      () => {
        dispatch({ type: 'set_account', account: undefined })
        dispatch({ type: 'set_provider', provider: undefined })
        dispatch({ type: 'set_connector', connector: undefined })
      },
      (err) => {
        console.error(err)
        dispatch({ type: 'set_error', error: new ConnectorNotFoundError() })
      }
    )
  }, [state.connector])

  useEffect(() => {
    async function tryAutoConnect(connectors: Connector[]) {
      // Autoconnect priority is defined by the order of the connectors.
      for (let i = 0; i < connectors.length; i++) {
        try {
          const connector = connectors[i]
          if (!(await connector.ready())) {
            // Not already authorized, try next.
            continue
          }

          const account = await connector.connect()
          dispatch({ type: 'set_account', account: account.address })
          dispatch({ type: 'set_provider', provider: account })
          dispatch({ type: 'set_connector', connector })

          // Success, stop trying.
          return
        } catch {
          // no-op, we continue trying the next connectors.
        }
      }
    }

    if (autoConnect && !account) {
      tryAutoConnect(connectors)
    }
    // Dependencies intentionally omitted since we only want
    // this executed once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { account, connect, disconnect, connectors, library, error }
}

/** Arguments for `StarknetProvider`. */
export interface StarknetProviderProps {
  /** Application. */
  children?: React.ReactNode
  /** Default provider, used when the user is not connected. */
  defaultProvider?: ProviderInterface
  /** List of connectors to use. */
  connectors?: Connector[]
  /** Connect the first available connector on page load. */
  autoConnect?: boolean
  /** Low-level react-query client to use. */
  queryClient?: QueryClient
}

/** Root StarkNet context provider. */
export function StarknetProvider({
  children,
  defaultProvider,
  connectors,
  autoConnect,
  queryClient,
}: StarknetProviderProps): JSX.Element {
  const state = useStarknetManager({ defaultProvider, connectors, autoConnect })
  return (
    <QueryClientProvider client={queryClient ?? new QueryClient()}>
      <StarknetContext.Provider value={state}>{children}</StarknetContext.Provider>
    </QueryClientProvider>
  )
}
