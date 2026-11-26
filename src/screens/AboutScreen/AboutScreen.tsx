import React, {useContext, useMemo, useState} from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  Pressable,
} from 'react-native';

import DeviceInfo from 'react-native-device-info';
import Clipboard from '@react-native-clipboard/clipboard';
import {Text} from 'react-native-paper';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {BuildInfo} from 'llama.rn';

import phononNotices from '../../assets/licenses/phononThirdPartyNotices.json';

import {CopyIcon} from '../../assets/icons';

import {Sheet} from '../../components';
import {useTheme} from '../../hooks';
import {createStyles} from './styles';
import {L10nContext} from '../../utils';
import {reflowNotice} from './reflowNotice';

export const AboutScreen: React.FC = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(theme, insets);
  const l10n = useContext(L10nContext);
  const [showNotices, setShowNotices] = useState(false);
  const noticeSections = useMemo(() => phononNotices.map(reflowNotice), []);
  const [legalItemTops, setLegalItemTops] = useState<Record<number, number>>(
    {},
  );

  const legalLinks: {
    id: 'privacy' | 'terms' | 'notices';
    label: string;
    role: 'link' | 'button';
    onPress: () => void;
    testID?: string;
  }[] = [
    {
      id: 'notices',
      label: l10n.about.openSourceNotices,
      role: 'button',
      onPress: () => setShowNotices(true),
      testID: 'about-open-source-notices',
    },
  ];

  const [appInfo, setAppInfo] = React.useState({
    version: '',
    build: '',
  });


  React.useEffect(() => {
    const version = DeviceInfo.getVersion();
    const buildNumber = DeviceInfo.getBuildNumber();
    setAppInfo({
      version,
      build: buildNumber,
    });
  }, []);

  const copyVersionToClipboard = () => {
    const versionString = `Version ${appInfo.version} (${appInfo.build})`;
    Clipboard.setString(versionString);
    Alert.alert(
      l10n.about.versionCopiedTitle,
      l10n.about.versionCopiedDescription,
    );
  };


  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Text variant="titleLarge" style={styles.title}>
                Idiotinator
              </Text>
              <Text variant="bodyMedium" style={styles.description}>
                Private AI workspace. Run language models on your device.
              </Text>
              <View style={styles.versionContainer}>
                <TouchableOpacity
                  style={styles.versionButton}
                  onPress={copyVersionToClipboard}>
                  <Text style={styles.versionText}>
                    v{appInfo.version} ({appInfo.build})
                  </Text>
                  <CopyIcon
                    width={16}
                    height={16}
                    stroke={theme.colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
              <Text style={styles.llamaBuildText}>
                llama.cpp {BuildInfo.number} ({BuildInfo.commit.substring(0, 7)}
                )
              </Text>
            </View>
          </View>

          <View style={styles.legalRow}>
            {legalLinks.map((link, i) => (
              <View
                key={link.id}
                style={styles.legalItem}
                testID={`about-legal-item-${i}`}
                onLayout={e => {
                  const {y} = e.nativeEvent.layout;
                  setLegalItemTops(tops =>
                    tops[i] === y ? tops : {...tops, [i]: y},
                  );
                }}>
                <Pressable
                  accessibilityRole={link.role}
                  onPress={link.onPress}
                  style={styles.legalHit}
                  testID={link.testID}>
                  <Text style={styles.legalLink}>{link.label}</Text>
                </Pressable>
                {i < legalLinks.length - 1 ? (
                  <Text
                    style={[
                      styles.legalSeparator,
                      legalItemTops[i] !== legalItemTops[i + 1] &&
                        styles.legalSeparatorHidden,
                    ]}
                    importantForAccessibility="no"
                    accessibilityElementsHidden>
                    ·
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <Sheet
        title={l10n.about.openSourceNotices}
        isVisible={showNotices}
        displayFullHeight
        onClose={() => setShowNotices(false)}>
        <Sheet.ScrollView
          contentContainerStyle={styles.noticesContent}
          testID="about-open-source-notices-sheet">
          <Text style={styles.noticesCredit}>
            {l10n.about.phononNoticesCredit}
          </Text>
          <Text selectable style={styles.noticesText}>{"MIT License\n\nCopyright (c) 2024 Asghar Ghorbani\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the \"Software\"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\nSOFTWARE.\n"}</Text>
          {noticeSections.map((section, i) => (
            <Text key={i} selectable style={styles.noticesText}>
              {section}
            </Text>
          ))}
        </Sheet.ScrollView>
      </Sheet>
    </SafeAreaView>
  );
};
