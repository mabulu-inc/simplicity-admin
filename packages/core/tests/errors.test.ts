import { describe, it, expect } from 'vitest';
import {
  ConfigError,
  ProviderError,
  PluginError,
  ValidationError,
  HookError,
  ActionError,
} from '@mabulu-inc/simplicity-admin-core';

describe('Error Classes', () => {
  describe('ConfigError', () => {
    it('has correct name and code', () => {
      const err = new ConfigError('missing field', 'CORE_001');
      expect(err.name).toBe('ConfigError');
      expect(err.code).toBe('CORE_001');
      expect(err.message).toBe('missing field');
    });

    it('extends Error', () => {
      const err = new ConfigError('test', 'CORE_001');
      expect(err).toBeInstanceOf(Error);
    });

    it('instanceof works', () => {
      const err = new ConfigError('test', 'CORE_002');
      expect(err).toBeInstanceOf(ConfigError);
      expect(err).not.toBeInstanceOf(ProviderError);
    });
  });

  describe('ProviderError', () => {
    it('has correct name and code', () => {
      const err = new ProviderError('not registered', 'CORE_004');
      expect(err.name).toBe('ProviderError');
      expect(err.code).toBe('CORE_004');
      expect(err.message).toBe('not registered');
    });

    it('extends Error', () => {
      const err = new ProviderError('test', 'CORE_004');
      expect(err).toBeInstanceOf(Error);
    });

    it('instanceof works', () => {
      const err = new ProviderError('test', 'CORE_004');
      expect(err).toBeInstanceOf(ProviderError);
      expect(err).not.toBeInstanceOf(ConfigError);
    });

    it('preserves cause when provided', () => {
      const cause = new Error('original');
      const err = new ProviderError('init failed', 'CORE_005', cause);
      expect(err.cause).toBe(cause);
    });
  });

  describe('PluginError', () => {
    it('has correct name and code', () => {
      const err = new PluginError('hook failed', 'CORE_006');
      expect(err.name).toBe('PluginError');
      expect(err.code).toBe('CORE_006');
      expect(err.message).toBe('hook failed');
    });

    it('extends Error', () => {
      const err = new PluginError('test', 'CORE_006');
      expect(err).toBeInstanceOf(Error);
    });

    it('instanceof works', () => {
      const err = new PluginError('test', 'CORE_006');
      expect(err).toBeInstanceOf(PluginError);
      expect(err).not.toBeInstanceOf(ConfigError);
    });

    it('preserves cause when provided', () => {
      const cause = new Error('original');
      const err = new PluginError('hook failed', 'CORE_006', cause);
      expect(err.cause).toBe(cause);
    });
  });

  describe('ValidationError', () => {
    it('has correct name and code', () => {
      const err = new ValidationError('invalid email', 'CORE_007');
      expect(err.name).toBe('ValidationError');
      expect(err.code).toBe('CORE_007');
      expect(err.message).toBe('invalid email');
    });

    it('extends Error', () => {
      const err = new ValidationError('test', 'CORE_007');
      expect(err).toBeInstanceOf(Error);
    });

    it('instanceof works', () => {
      const err = new ValidationError('test', 'CORE_007');
      expect(err).toBeInstanceOf(ValidationError);
      expect(err).not.toBeInstanceOf(ConfigError);
    });
  });

  describe('HookError', () => {
    it('has correct name and code', () => {
      const err = new HookError('before-hook threw', 'CORE_008');
      expect(err.name).toBe('HookError');
      expect(err.code).toBe('CORE_008');
      expect(err.message).toBe('before-hook threw');
    });

    it('extends Error', () => {
      const err = new HookError('test', 'CORE_008');
      expect(err).toBeInstanceOf(Error);
    });

    it('instanceof works', () => {
      const err = new HookError('test', 'CORE_008');
      expect(err).toBeInstanceOf(HookError);
      expect(err).not.toBeInstanceOf(PluginError);
    });

    it('preserves cause when provided', () => {
      const cause = new Error('original');
      const err = new HookError('hook failed', 'CORE_008', cause);
      expect(err.cause).toBe(cause);
    });
  });

  describe('ActionError', () => {
    it('has correct name and code', () => {
      const err = new ActionError('condition not met', 'CORE_010');
      expect(err.name).toBe('ActionError');
      expect(err.code).toBe('CORE_010');
      expect(err.message).toBe('condition not met');
    });

    it('extends Error', () => {
      const err = new ActionError('test', 'CORE_010');
      expect(err).toBeInstanceOf(Error);
    });

    it('instanceof works', () => {
      const err = new ActionError('test', 'CORE_010');
      expect(err).toBeInstanceOf(ActionError);
      expect(err).not.toBeInstanceOf(HookError);
    });

    it('preserves cause when provided', () => {
      const cause = new Error('original');
      const err = new ActionError('handler failed', 'CORE_012', cause);
      expect(err.cause).toBe(cause);
    });
  });
});
