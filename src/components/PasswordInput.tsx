import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { Platform, StyleSheet, TextInput, TextInputProps } from 'react-native';

/**
 * TextInput otimizado para senhas:
 * No Android, fontes customizadas (como GlacialR) não contêm o caractere de bullet '•' (\u2022).
 * Isso faz o Android travar por vários segundos tentando renderizar o caractere em texto limpo
 * antes de fazer fallback, criando um atraso enorme para o caractere virar "bolinha".
 *
 * Ao definir explicitamente fontFamily como 'sans-serif' no Android quando secureTextEntry
 * está ativo, o sistema utiliza a fonte nativa padrão que possui o glifo nativo de bullet,
 * transformando o caractere em "bolinha" de forma instantânea sem atrasos.
 */
const PasswordInput = forwardRef<TextInput, TextInputProps>((props, ref) => {
    const innerRef = useRef<TextInput>(null);
    useImperativeHandle(ref, () => innerRef.current as TextInput);

    const flattenedStyle = StyleSheet.flatten(props.style) || {};
    const effectiveStyle: any = {
        ...flattenedStyle,
        ...(props.secureTextEntry && Platform.OS === 'android' ? { fontFamily: 'sans-serif' } : {}),
    };

    return (
        <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            {...props}
            ref={innerRef}
            style={effectiveStyle}
        />
    );
});

PasswordInput.displayName = 'PasswordInput';

export default PasswordInput;
