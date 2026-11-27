import React, {useContext} from 'react';
import {View} from 'react-native';
import Svg, {Path, Rect} from 'react-native-svg';
import {Button, Text} from 'react-native-paper';
import {observer} from 'mobx-react';

import {useTheme} from '../../hooks';
import {createStyles} from './styles';
import {modelStore, palStore} from '../../store';
import {useNavigation} from '@react-navigation/native';
import {NavigationProp} from '@react-navigation/native';
import {L10nContext} from '../../utils';

interface ChatEmptyPlaceholderProps {
  onSelectModel: () => void;
  bottomComponentHeight: number;
}

export const ChatEmptyPlaceholder = observer(
  ({onSelectModel, bottomComponentHeight}: ChatEmptyPlaceholderProps) => {
    const theme = useTheme();
    const navigation = useNavigation<NavigationProp<any>>();
    const l10n = useContext(L10nContext);
    const styles = createStyles({theme});

    const hasAvailableModels = modelStore.availableModels.length > 0;
    const hasActiveModel = modelStore.activeModelId !== undefined;
    // When the user lands here from onboarding-finish, the pal exists
    // and its defaultModel is downloading. The DownloadOverlay banner is
    // already showing progress at the top of the screen — the empty
    // state's job is just to telegraph "your pal is on the way, no
    // model picker needed."
    const pendingPalDownload = modelStore.activeDownloads
      .map(d =>
        palStore.pals.find(
          p =>
            p.source === 'local' &&
            p.defaultModel &&
            p.defaultModel.id === d.modelId,
        ),
      )
      .find(p => p !== undefined);

    const getContent = () => {
      if (pendingPalDownload) {
        return {
          title:
            l10n.components.chatEmptyPlaceholder.gettingReadyTitle?.replace(
              '{{name}}',
              pendingPalDownload.name,
            ) ?? `${pendingPalDownload.name} is getting ready`,
          description:
            l10n.components.chatEmptyPlaceholder.gettingReadyDescription ??
            'We’ll let you know the moment your assistant can chat. Tap the banner up top to see how it’s going.',
          buttonText: null,
          onPress: () => {},
        };
      }

      if (!hasAvailableModels) {
        return {
          title: l10n.components.chatEmptyPlaceholder.noModelsTitle,
          description: l10n.components.chatEmptyPlaceholder.noModelsDescription,
          buttonText: l10n.components.chatEmptyPlaceholder.noModelsButton,
          onPress: () => {
            navigation.navigate('Models');
          },
        };
      }

      return {
        title: l10n.components.chatEmptyPlaceholder.activateModelTitle,
        description:
          l10n.components.chatEmptyPlaceholder.activateModelDescription,
        buttonText: l10n.components.chatEmptyPlaceholder.activateModelButton,
        onPress: onSelectModel,
      };
    };

    const {title, description, buttonText, onPress} = getContent();

    if (hasActiveModel) {
      return <View />;
    }
    return (
      <View
        style={[styles.container, {marginBottom: bottomComponentHeight + 100}]}>
        <Svg width={112} height={112} viewBox="0 0 112 112">
          <Rect width={112} height={112} rx={30} fill="#10171B" />
          <Path
            d="M56 14 L92 35 L92 77 L56 98 L20 77 L20 35 Z"
            stroke="#78DCC8"
            strokeWidth={4}
            fill="none"
          />
          <Path
            d="M43 36 H69 M56 36 V76 M43 76 H69"
            stroke="#78DCC8"
            strokeWidth={6}
            strokeLinecap="round"
          />
        </Svg>
        <View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
        </View>
        {buttonText ? (
          <Button
            mode="contained"
            onPress={onPress}
            style={styles.button}
            loading={modelStore.isContextLoading}
            disabled={hasActiveModel}>
            {modelStore.isContextLoading
              ? l10n.components?.chatEmptyPlaceholder?.loading
              : buttonText}
          </Button>
        ) : null}
      </View>
    );
  },
);
