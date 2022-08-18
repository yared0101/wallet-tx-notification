export type session = {
    [key: string]:
        | {}
        | {
              [key: DisplayStrings.addChannel | ChannelSelected.editChannel]: {
                  channelId?: string;
                  name?: string;
                  description?: string;
              };
          }
        | {
              [key: DisplayStrings.addWallet]: {
                  account?: string;
                  nameTag?: string;
              };
          }
        | {
              [key: DisplayStrings.removeWallet]: {
                  wallets: import("@prisma/client").Account[];
                  index: number;
              };
          }
        | {
              [key: DisplayStrings.removeChannel]: {
                  channels: import("@prisma/client").Channel[];
                  index: number;
              };
          }
        | {
              [key: DisplayStrings.removeChannel]: {
                  channels: import("@prisma/client").Channel[];
                  index: number;
              };
          }
        | {
              setting?: {
                  [key: ChannelSelected.addWalletToChannel]: {
                      wallets: import("@prisma/client").Account[];
                      index: number;
                  };
              };
              selectedChannelId?: string;
          }
        | {
              setting?: {
                  [key: ChannelSelected.removeWalletFromChannel]: {
                      wallets: import("@prisma/client").Account[];
                      index: number;
                  };
              };
              selectedChannelId?: string;
          }
        | {};
};
export type displayStrings = {
    addChannel: DisplayStrings.addChannel;
    removeChannel: DisplayStrings.removeChannel;
    listChannels: DisplayStrings.listChannels;
    listWallets: DisplayStrings.listWallets;
    selectChannel: DisplayStrings.selectChannel;
    addWallet: DisplayStrings.addWallet;
    removeWallet: DisplayStrings.removeWallet;
    channelSelected: ChannelSelected;
    channelConfigs: ChannelConfigs;
    home: DisplayStrings.home;
};
enum DisplayStrings {
    addChannel = "Add Channel",
    removeChannel = "Remove Channel",
    listChannels = "Channel List",
    listWallets = "Wallet List",
    selectChannel = "Select Channel",
    addWallet = "Add Wallet",
    removeWallet = "Remove Wallet",
    home = "Home",
}

enum ChannelSelected {
    addWalletToChannel = "Add Wallet to Channel",
    removeWalletFromChannel = "Remove Wallet from Channel",
    listWalletsInChannel = "List Wallets",
    channelSettings = "Channel Settings",
    editChannel = "Edit Channel",
}
type ChannelConfigs = {
    sendPending: (status: boolean) => string;
    sendComplete: (status: boolean) => string;
    sendSellTx: (status: boolean) => string;
    sendBuyTx: (status: boolean) => string;
};
